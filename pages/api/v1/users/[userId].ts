import type { NextApiRequest, NextApiResponse } from 'next'
import { UserService } from '@/services/userService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.query

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' })
  }

  const authUserId = String((req as { user?: { sub?: string } }).user?.sub || '')
  if (!authUserId || authUserId !== userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const userService = new UserService()
    const user = await userService.getUserById(userId)

    // Remove password from response for security
    const { password: _, ...userWithoutPassword } = user

    res.status(200).json(serializeBigInt({ user: userWithoutPassword }))
  } catch (error: any) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
}

export default withAuth(handler)