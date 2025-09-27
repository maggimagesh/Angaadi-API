import { PrismaClient } from '@prisma/client'
import { CreateUserInput } from './user.dto'

const prisma = new PrismaClient()

export async function createUserService(input: CreateUserInput) {
  const user = await prisma.userDetails.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      emailId: input.emailId,
      password: input.password,
    },
  })
  return user
}


