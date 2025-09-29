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
    const users = await userService.getAllUsers()

    // Remove passwords from all users for security
    const usersWithoutPasswords = users.map(({ password: _, ...user }) => user)

    res.status(200).json(serializeBigInt({ users: usersWithoutPasswords }))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export default withAuth(handler)