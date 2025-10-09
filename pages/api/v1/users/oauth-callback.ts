import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { UserService } from '@/services/userService'
import { signToken } from '@/lib/auth'
import { serializeBigInt } from '@/utils/serialize'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { code, error: oauthError } = req.query

    if (oauthError) {
      console.error('OAuth callback error:', oauthError)
      return res.status(400).json({
        error: 'OAuth authentication failed',
        details: oauthError
      })
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' })
    }

    // Exchange the authorization code for a session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.exchangeCodeForSession(code as string)

    if (sessionError || !sessionData.session) {
      console.error('Session exchange error:', sessionError)
      return res.status(500).json({
        error: 'Failed to exchange authorization code',
        details: sessionError?.message
      })
    }

    const { session } = sessionData
    const { user } = session

    if (!user?.email) {
      return res.status(400).json({ error: 'User email is required' })
    }

    // Check if user exists in our userDetails table
    const userService = new UserService()
    let existingUser

    try {
      existingUser = await userService.getUserByEmail(user.email)
    } catch (error) {
      // User doesn't exist, create a new one
      existingUser = null
    }

    let userDetails

    if (!existingUser) {
      // Create new user in userDetails table
      const names = user.user_metadata?.full_name?.split(' ') || ['', '']
      const firstName = names[0] || user.user_metadata?.name || 'Unknown'
      const lastName = names.slice(1).join(' ') || ''

      userDetails = await userService.createUser({
        firstName,
        lastName,
        emailId: user.email,
        password: '' // OAuth users don't use passwords
      })

      // Note: We'll link the Supabase ID later when database is migrated
      // For now, we store the mapping in memory or handle it differently
    } else {
      userDetails = existingUser
    }

    // Generate JWT token for our application
    const payload = { sub: String(userDetails.id), emailId: userDetails.emailId }
    const token = await signToken(payload)

    // Remove password from response
    const { password: _, ...userWithoutPassword } = userDetails

    // Redirect to frontend with token or return JSON response
    const redirectUrl = process.env.OAUTH_SUCCESS_REDIRECT || '/'

    // Check if this is a popup-based authentication
    const isPopup = req.query.popup === 'true' || req.headers['x-popup-auth'] === 'true'

    if (isPopup || req.headers.accept?.includes('application/json')) {
      // API response for popup or JSON requests
      res.status(200).json(serializeBigInt({
        user: userWithoutPassword,
        token,
        message: 'OAuth authentication successful',
        popup: true
      }))
    } else {
      // Redirect response with token in query params
      const redirectWithToken = `${redirectUrl}?token=${token}&user=${encodeURIComponent(JSON.stringify(serializeBigInt(userWithoutPassword)))}`
      res.redirect(302, redirectWithToken)
    }

  } catch (error: any) {
    console.error('OAuth callback handler error:', error)
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

export default withCORS(handler)
