import type { NextApiRequest, NextApiResponse } from 'next'
import { UserService, SignInInput } from '@/services/userService'
import { serializeBigInt } from '@/utils/serialize'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { emailId, password }: SignInInput = req.body

    if (!emailId || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const userService = new UserService()
    const result = await userService.signIn({
      emailId,
      password,
    })

    // Remove password from user response for security
    const { password: _, ...userWithoutPassword } = result.user

    res.status(200).json(serializeBigInt({ user: userWithoutPassword, token: result.token }))
  } catch (error: any) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
}

export default withCORS(handler)