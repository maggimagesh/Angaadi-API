import type { NextApiRequest, NextApiResponse } from 'next'
import { PasswordResetService, ResetPasswordInput } from '@/services/passwordResetService'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { resetToken, newPassword, confirmPassword }: ResetPasswordInput = req.body

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Reset token, new password, and confirm password are required' })
    }

    // Password validation
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' })
    }

    const passwordResetService = new PasswordResetService()
    const result = await passwordResetService.resetPassword({
      resetToken,
      newPassword,
      confirmPassword,
    })

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Reset password error:', error)

    if (error.message === 'Passwords do not match') {
      return res.status(400).json({ error: error.message })
    }

    if (error.message === 'Invalid or expired reset token') {
      return res.status(400).json({ error: error.message })
    }

    res.status(500).json({ error: 'Internal server error' })
  }
}

export default withCORS(handler)
