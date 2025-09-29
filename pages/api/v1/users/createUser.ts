import type { NextApiRequest, NextApiResponse } from 'next'
import { UserService, CreateUserInput } from '@/services/userService'
import { authenticateRequest } from '@/lib/auth'
import { serializeBigInt } from '@/utils/serialize'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check if user is authenticated (for protected routes) - this is not required for createUser
    // const user = await authenticateRequest(req)
    // if (user) {
    //   return res.status(400).json({ error: 'Already authenticated' })
    // }

    const { firstName, lastName, emailId, password }: CreateUserInput = req.body

    if (!firstName || !lastName || !emailId || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const userService = new UserService()
    const createdUser = await userService.createUser({
      firstName,
      lastName,
      emailId,
      password,
    })

    // Remove password from response for security
    const { password: _, ...userWithoutPassword } = createdUser

    res.status(200).json(serializeBigInt({ user: userWithoutPassword }))
  } catch (error: any) {
    if (error.message === 'Email already exists') {
      return res.status(409).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
}