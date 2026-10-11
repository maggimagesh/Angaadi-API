import type { NextApiRequest, NextApiResponse } from 'next'
import { UserService } from '@/services/userService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userService = new UserService()
    const authUser = (req as { user?: { sub?: string; emailId?: string } }).user
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
    const isAdmin = !!authUser?.emailId && adminEmails.includes(authUser.emailId.toLowerCase())

    // Listing every account's name and email is admin-only; everyone else gets
    // just their own record, in the same response shape.
    const users = isAdmin
      ? await userService.getAllUsers()
      : [await userService.getUserById(String(authUser?.sub || ''))]

    // Remove passwords from all users for security
    const usersWithoutPasswords = users.map(({ password: _, ...user }) => user)

    res.status(200).json(serializeBigInt({ users: usersWithoutPasswords }))
  } catch (error: any) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
}

export default withAuth(handler)