import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface ShoeSize {
  id: number
  size: Prisma.Decimal
  width: string
  created_at: Date | null
}

export interface UserShoeSizeSelection {
  id: bigint
  userId: bigint | null
  shoeSizeId: number | null
  created_at: Date
  updated_at: Date | null
  isActive: number | null
  shoeSize?: ShoeSize | null
}

export interface UserShoeSizeInput {
  userId: bigint
  shoeSizeId: number
}

export class ShoeSizeService {
  async getAllShoeSizes(): Promise<ShoeSize[]> {
    return prisma.shoeSize.findMany({
      orderBy: [{ size: 'asc' }, { width: 'asc' }]
    })
  }

  async getShoeSizeById(id: number): Promise<ShoeSize | null> {
    return prisma.shoeSize.findUnique({
      where: { id }
    })
  }

  async getShoeSizeBySizeAndWidth(size: number, width: string): Promise<ShoeSize | null> {
    return prisma.shoeSize.findFirst({
      where: {
        size: size,
        width: width
      }
    })
  }

  async saveUserShoeSize(input: UserShoeSizeInput): Promise<UserShoeSizeSelection> {
    const { userId, shoeSizeId } = input

    const shoeSize = await this.getShoeSizeById(shoeSizeId)
    if (!shoeSize) {
      throw new Error('Invalid shoe size ID')
    }

    const user = await prisma.userDetails.findUnique({
      where: { id: userId }
    })
    if (!user) {
      throw new Error('Invalid user ID')
    }

    const existingActive = await prisma.userShoeSize.findFirst({
      where: {
        userId,
        shoeSizeId,
        isActive: 1
      }
    })

    if (existingActive) {
      throw new Error('This shoe size is already active for the user')
    }

    await prisma.userShoeSize.updateMany({
      where: {
        userId,
        isActive: 1
      },
      data: {
        isActive: null,
        updated_at: new Date()
      }
    })

    return prisma.userShoeSize.create({
      data: {
        userId,
        shoeSizeId,
        isActive: 1
      },
      include: {
        shoeSize: true
      }
    })
  }

  async getActiveUserShoeSize(userId: bigint): Promise<UserShoeSizeSelection | null> {
    return prisma.userShoeSize.findFirst({
      where: {
        userId,
        isActive: 1
      },
      include: {
        shoeSize: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async deactivateUserShoeSize(userId: bigint): Promise<void> {
    const activeSelection = await prisma.userShoeSize.findFirst({
      where: {
        userId,
        isActive: 1
      }
    })

    if (!activeSelection) {
      throw new Error('No active shoe size found for this user')
    }

    await prisma.userShoeSize.update({
      where: {
        id: activeSelection.id
      },
      data: {
        isActive: null,
        updated_at: new Date()
      }
    })
  }
}
