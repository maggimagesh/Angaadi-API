import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { redirectTo, provider } = req.body || {}

    // Validate provider
    if (provider && provider !== 'google') {
      return res.status(400).json({
        error: 'Unsupported provider',
        details: `Provider '${provider}' is not supported. Only 'google' is supported.`
      })
    }

    // Get the base URL for the callback
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`

    const redirectUrl = redirectTo || `${baseUrl}/api/v1/users/oauth-callback`

    // Initiate Google OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        scopes: 'email profile',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('OAuth sign-in error:', error)
      return res.status(500).json({
        error: 'Failed to initiate OAuth sign-in',
        details: error.message
      })
    }

    // Return the authorization URL for the client to redirect to
    res.status(201).json({
      url: data.url,
      provider: 'google'
    })

  } catch (error: any) {
    console.error('OAuth sign-in handler error:', error)
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}

export default withCORS(handler)
