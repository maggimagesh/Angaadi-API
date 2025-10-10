import type { NextApiRequest, NextApiResponse } from 'next'
import { PasswordResetService, VerifyOTPInput } from '@/services/passwordResetService'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Basic OTP validation (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'OTP must be 6 digits' })
    }

    const passwordResetService = new PasswordResetService()
    const result = await passwordResetService.verifyOTP({ emailId: email, otp })

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Verify OTP error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export default withCORS(handler)
