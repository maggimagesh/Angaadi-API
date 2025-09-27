import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PreferredDepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createPreferredDepartment(input: { userId: number; genderId: number }) {
    const userId = BigInt(input.userId)
    const genderId = BigInt(input.genderId)

    // Mark any existing active preferences for this user as inactive
    await this.prisma.preferredDepartment.updateMany({
      where: { userId, isActive: 1 },
      data: { isActive: 0 },
    })

    const preference = await this.prisma.preferredDepartment.create({
      data: { userId, genderId, isActive: 1 },
    })
    return preference
  }

  async getLatestPreferredDepartmentByUserId(userIdParam: string) {
    let userId: bigint
    try {
      userId = BigInt(userIdParam)
    } catch (_e) {
      return null
    }

    const preference = await this.prisma.preferredDepartment.findFirst({
      where: { userId, isActive: 1 },
      orderBy: { id: 'desc' },
      include: { gender: true },
    })
    return preference
  }

  async deactivateByUserId(userIdParam: string) {
    let userId: bigint
    try {
      userId = BigInt(userIdParam)
    } catch (_e) {
      return { count: 0 }
    }

    const result = await this.prisma.preferredDepartment.updateMany({
      where: { userId, isActive: 1 },
      data: { isActive: 0 },
    })
    return result
  }
}
