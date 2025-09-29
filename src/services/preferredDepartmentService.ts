import prisma from '@/lib/prisma'

export interface PreferredDepartmentInput {
  userId: string
  genderId: string
}

export interface PreferredDepartment {
  id: bigint
  userId: bigint | null
  genderId: bigint | null
  gender?: string | null  // Add the actual gender name
  created_at: Date
  updated_at: Date | null
  isActive: number
}

export class PreferredDepartmentService {
  async createPreferredDepartment(input: PreferredDepartmentInput): Promise<PreferredDepartment> {
    const userId = BigInt(input.userId)
    const genderId = BigInt(input.genderId)

    const result = await prisma.preferredDepartment.create({
      data: {
        userId,
        genderId,
        isActive: 1,
      },
      include: {
        gender: true  // Include the related gender record
      }
    })

    // Return with the gender name, handling potential nulls safely
    return {
      id: result.id,
      userId: result.userId,
      genderId: result.genderId,
      gender: result.gender ? result.gender.gender : null,
      created_at: result.created_at,
      updated_at: result.updated_at,
      isActive: result.isActive
    }
  }

  async getLatestPreferredDepartmentByUserId(userIdParam: string): Promise<PreferredDepartment | null> {
    const userId = BigInt(userIdParam)

    // First get the preferred department record
    const result = await prisma.preferredDepartment.findFirst({
      where: {
        userId,
        isActive: 1,
      },
      orderBy: {
        created_at: 'desc',
      },
      include: {
        gender: true  // Include the related gender record
      }
    })

    if (!result) return null

    // Return with the gender name, handling potential nulls safely
    return {
      id: result.id,
      userId: result.userId,
      genderId: result.genderId,
      gender: result.gender?.gender || null,
      created_at: result.created_at,
      updated_at: result.updated_at,
      isActive: result.isActive
    }
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