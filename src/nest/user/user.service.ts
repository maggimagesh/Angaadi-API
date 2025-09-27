import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async createUser(input: {
    firstName: string
    lastName: string
    emailId: string
    password: string
  }) {
    try {
      const user = await this.prisma.userDetails.create({
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
        throw new ConflictException('Email already exists')
      }
      throw error
    }
  }

  async getAllUsers() {
    const users = await this.prisma.userDetails.findMany()
    return users
  }

  async getUserById(userIdParam: string) {
    let userId: bigint
    try {
      userId = BigInt(userIdParam)
    } catch (_e) {
      throw new NotFoundException('User not found')
    }

    const user = await this.prisma.userDetails.findUnique({
      where: { id: userId },
    })
    if (!user) {
      throw new NotFoundException('User not found')
    }
    return user
  }

  async signIn(input: { emailId: string; password: string }) {
    const user = await this.prisma.userDetails.findFirst({
      where: { emailId: input.emailId },
    })
    if (!user || user.password !== input.password) {
      throw new UnauthorizedException('Invalid credentials')
    }
    const payload = { sub: String(user.id), emailId: user.emailId }
    const token = this.authService.signToken(payload)
    return { user, token }
  }
}


