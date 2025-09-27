import { Request, Response } from 'express'
import { CreateUserDto } from './user.dto'
import { createUserService } from './user.service'

export async function createUserController(req: Request, res: Response) {
  const parse = CreateUserDto.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ error: 'Validation error', details: parse.error.flatten() })
  }
  try {
    const user = await createUserService(parse.data)
    return res.status(201).json({ user })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create user', message: err?.message })
  }
}


