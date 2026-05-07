import { Resend } from 'resend'
import { randomBytes, randomInt } from 'crypto'
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
    // Generate a 6-digit OTP using a cryptographically strong RNG
    return randomInt(100000, 1000000).toString()
  }

  private generateResetToken(): string {
    // 32 random bytes = 256 bits of entropy, encoded as URL-safe hex
    return randomBytes(32).toString('hex')
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
                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAARGVYSWZNTQAqAAAACAABh2kABAAAAA****************************************************************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" alt="Angaadi Logo" style="width: 100px; height: 100px; object-fit: contain;" />
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
      throw new Error('User not available')
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
