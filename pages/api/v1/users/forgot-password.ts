import type { NextApiRequest, NextApiResponse } from 'next'
import { PasswordResetService, ForgotPasswordInput } from '@/services/passwordResetService'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    const passwordResetService = new PasswordResetService()
    const result = await passwordResetService.requestPasswordReset({ emailId: email })

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Forgot password error:', error)
    if (error.message === 'User not available') {
      return res.status(404).json({ error: error.message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export default withCORS(handler)
