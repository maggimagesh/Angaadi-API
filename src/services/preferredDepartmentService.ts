import prisma from '@/lib/prisma'

export interface PreferredDepartmentInput {
  userId: string
  genderId: string
}

export interface PreferredDepartment {
  id: bigint
  userId: bigint | null
  genderId: bigint | null
  created_at: Date
  updated_at: Date | null
  isActive: number
}

export class PreferredDepartmentService {
  async createPreferredDepartment(input: PreferredDepartmentInput): Promise<PreferredDepartment> {
    const userId = BigInt(input.userId)
    const genderId = BigInt(input.genderId)

    return await prisma.preferredDepartment.create({
      data: {
        userId,
        genderId,
        isActive: 1,
      },
    })
  }

  async getLatestPreferredDepartmentByUserId(userIdParam: string): Promise<PreferredDepartment | null> {
    const userId = BigInt(userIdParam)

    return await prisma.preferredDepartment.findFirst({
      where: {
        userId,
        isActive: 1,
      },
      orderBy: {
        created_at: 'desc',
      },
    })
  }

  async deactivateByUserId(userIdParam: string): Promise<void> {
    const userId = BigInt(userIdParam)

    await prisma.preferredDepartment.updateMany({
      where: {
        userId,
        isActive: 1,
      },
      data: {
        isActive: 0,
      },
    })
  }
}