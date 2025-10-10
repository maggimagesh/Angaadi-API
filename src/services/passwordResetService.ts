import { Resend } from 'resend'
import prisma from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface ForgotPasswordInput {
  emailId: string
}

export interface VerifyOTPInput {
  emailId: string
  otp: string
}

export interface ResetPasswordInput {
  resetToken: string
  newPassword: string
  confirmPassword: string
}

export interface OTPRecord {
  id: bigint
  opts: string | null
  userId: bigint | null
  email: string | null
  expiresAt: Date | null
  used: boolean | null
  resetToken: string | null
  created_at: Date
}

export class PasswordResetService {
  private generateOTP(): string {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  private generateResetToken(): string {
    // Generate a secure reset token
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  async sendPasswordResetEmail(emailId: string, otp: string): Promise<void> {
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Angaadi</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
              <div style="background-color: #ffffff; border-radius: 50%; width: 120px; height: 120px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <img src="${process.env.FRONTEND_URL || 'http://localhost:3300'}/images/Angaadi.png" alt="Angaadi Logo" style="width: 100px; height: 100px; object-fit: contain;" />
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 300;">Angaadi</h1>
              <p style="color: #ffffff; margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Your Global Market</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #333333; margin: 0 0 10px; font-size: 24px; font-weight: 600;">Password Reset Request</h2>
                <div style="width: 60px; height: 3px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0 auto;"></div>
              </div>

              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                <p style="color: #555555; margin: 0 0 15px; font-size: 16px; line-height: 1.6;">
                  Hello! We received a request to reset the password for your Angaadi account. If you made this request, please use the verification code below:
                </p>
              </div>

              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                <p style="color: #ffffff; margin: 0 0 10px; font-size: 14px; font-weight: 500;">Your Verification Code</p>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 15px; margin: 10px 0; display: inline-block;">
                  <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
                </div>
                <p style="color: #ffffff; margin: 10px 0 0; font-size: 12px; opacity: 0.9;">This code expires in 5 minutes</p>
              </div>

              <!-- Instructions -->
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="color: #856404; margin: 0 0 10px; font-size: 16px; font-weight: 600;">📋 Instructions:</h3>
                <ul style="color: #856404; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                  <li>Enter this code in the password reset form</li>
                  <li>Create a new secure password</li>
                  <li>Confirm your new password</li>
                  <li>Complete the password reset process</li>
                </ul>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="color: #721c24; margin: 0 0 10px; font-size: 16px; font-weight: 600;">🔒 Security Notice:</h3>
                <p style="color: #721c24; margin: 0; font-size: 14px; line-height: 1.6;">
                  If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made.
                </p>
              </div>

              <!-- Support -->
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; margin: 0 0 10px; font-size: 14px;">
                  Need help? Contact our support team
                </p>
                <a href="mailto:support@angaadi.online" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 14px;">
                  support@angaadi.online
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; margin: 0 0 10px; font-size: 12px;">
                © 2024 Angaadi. All rights reserved.
              </p>
              <div style="margin-top: 15px;">
                <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Privacy Policy</a>
                <span style="color: #dee2e6;">|</span>
                <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Terms of Service</a>
                <span style="color: #dee2e6;">|</span>
                <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Unsubscribe</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      console.log('Sending password reset email to:', emailId)
      console.log('OTP:', otp)

      const result = await resend.emails.send({
        from: 'no-reply@angaadi.online', // Using Resend's default verified sender
        to: emailId,
        subject: 'Password Reset OTP - Angaadi',
        html: emailHtml,
      })

      console.log('Email sent successfully:', result)
    } catch (error) {
      console.error('Error sending password reset email:', error)
      throw new Error('Failed to send password reset email')
    }
  }

  async createOTPRecord(email: string, userId?: bigint): Promise<OTPRecord> {
    const otp = this.generateOTP()
    const resetToken = this.generateResetToken()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    const otpRecord = await prisma.otp.create({
      data: {
        opts: otp,
        email,
        userId,
        expiresAt,
        used: false,
        resetToken,
      },
    })

    return otpRecord
  }

  async requestPasswordReset(input: ForgotPasswordInput): Promise<{ message: string }> {
    // Check if user exists
    const user = await prisma.userDetails.findUnique({
      where: { emailId: input.emailId },
    })

    if (!user) {
      // Don't reveal if email exists or not for security
      return { message: 'If an account with that email exists, a password reset OTP has been sent.' }
    }

    // Create new OTP record (always create new, don't update existing)
    const otpRecord = await this.createOTPRecord(input.emailId, user.id)

    // Send email
    await this.sendPasswordResetEmail(input.emailId, otpRecord.opts || '')

    return { message: 'Password reset OTP sent to your email' }
  }

  async verifyOTP(input: VerifyOTPInput): Promise<{ valid: boolean; resetToken?: string; message: string }> {
    // Find valid OTP record
    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: input.emailId,
        opts: input.otp,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    if (!otpRecord) {
      return { valid: false, message: 'Invalid or expired OTP' }
    }

    // Mark OTP as used
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    })

    return {
      valid: true,
      resetToken: otpRecord.resetToken || '',
      message: 'OTP verified successfully'
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    // Validate passwords match
    if (input.newPassword !== input.confirmPassword) {
      throw new Error('Passwords do not match')
    }

    // Find and validate reset token
    const otpRecord = await prisma.otp.findFirst({
      where: {
        resetToken: input.resetToken,
        used: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!otpRecord) {
      throw new Error('Invalid or expired reset token')
    }

    // Update password
    await prisma.userDetails.update({
      where: { id: otpRecord.userId! },
      data: { password: input.newPassword },
    })

    // Note: OTP records are preserved for audit purposes
    // No cleanup is performed to maintain data integrity

    return { message: 'Password updated successfully' }
  }

}
