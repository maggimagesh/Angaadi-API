import prisma from '@/lib/prisma'

export interface CreateUserInput {
  firstName: string
  lastName: string
  emailId: string
  password: string
}

export interface SignInInput {
  emailId: string
  password: string
}

export interface CreateOAuthUserInput {
  firstName: string
  lastName: string
  emailId: string
  supabaseUserId: string
}

export interface User {
  id: bigint
  created_at: Date
  firstName: string
  lastName: string
  emailId: string
  password: string
  supabaseUserId?: string | null
  updated_at: Date | null
}

export interface SignInResult {
  user: User
  token: string
}

export class UserService {
  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const user = await prisma.userDetails.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          emailId: input.emailId,
          password: input.password,
        },
      })
      return user
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new Error('Email already exists')
      }
      throw error
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await prisma.userDetails.findMany()
  }

  async getUserById(userIdParam: string): Promise<User> {
    let userId: bigint
    try {
      userId = BigInt(userIdParam)
    } catch (_e) {
      throw new Error('User not found')
    }

    const user = await prisma.userDetails.findUnique({
      where: { id: userId },
    })
    if (!user) {
      throw new Error('User not found')
    }
    return user
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    const user = await prisma.userDetails.findFirst({
      where: { emailId: input.emailId },
    })
    if (!user || user.password !== input.password) {
      throw new Error('Invalid credentials')
    }

    // Import here to avoid circular dependencies
    const { signToken } = await import('@/lib/auth')
    const payload = { sub: String(user.id), emailId: user.emailId }
    const token = await signToken(payload)
    return { user, token }
  }

  async getUserByEmail(emailId: string): Promise<User> {
    const user = await prisma.userDetails.findUnique({
      where: { emailId },
    })
    if (!user) {
      throw new Error('User not found')
    }
    return user
  }

  async createOAuthUser(input: CreateOAuthUserInput): Promise<User> {
    try {
      const user = await prisma.userDetails.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          emailId: input.emailId,
          password: '', // OAuth users don't need passwords
          supabaseUserId: input.supabaseUserId,
        },
      })
      return user
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new Error('Email already exists')
      }
      throw error
    }
  }

  async linkOAuthUser(userId: bigint, supabaseUserId: string): Promise<User> {
    try {
      const user = await prisma.userDetails.update({
        where: { id: userId },
        data: { supabaseUserId },
      })
      return user
    } catch (error: any) {
      throw new Error('Failed to link OAuth user')
    }
  }
}