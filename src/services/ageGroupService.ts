import prisma from '@/lib/prisma'

export interface AgeGroup {
  id: bigint
  ageRange: string
  minAge: number | null
  maxAge: number | null
  created_at: Date
  updated_at: Date | null
}

export interface UserAgeGroup {
  id: bigint
  userId: bigint | null
  ageGroupId: bigint | null
  created_at: Date
  updated_at: Date | null
  isActive: number
}

export interface UserAgeGroupInput {
  userId: bigint
  ageGroupId: bigint
}

export class AgeGroupService {
  /**
   * Get all age groups
   */
  async getAllAgeGroups(): Promise<AgeGroup[]> {
    return await prisma.ageGroup.findMany({
      orderBy: {
        minAge: 'asc'
      }
    })
  }

  /**
   * Get age group by ID
   */
  async getAgeGroupById(id: bigint): Promise<AgeGroup | null> {
    return await prisma.ageGroup.findUnique({
      where: { id }
    })
  }

  /**
   * Create or update user's age group preference
   * If user already has an active age group, deactivate it first
   */
  async saveUserAgeGroup(input: UserAgeGroupInput): Promise<UserAgeGroup> {
    const { userId, ageGroupId } = input

    // Validate that the age group exists
    const ageGroup = await this.getAgeGroupById(ageGroupId)
    if (!ageGroup) {
      throw new Error('Invalid age group ID')
    }

    // Validate that the user exists
    const user = await prisma.userDetails.findUnique({
      where: { id: userId }
    })
    if (!user) {
      throw new Error('Invalid user ID')
    }

    // Check if user already has this age group active
    const existingActiveAgeGroup = await prisma.userAgeGroup.findFirst({
      where: {
        userId,
        ageGroupId,
        isActive: 1
      }
    })

    if (existingActiveAgeGroup) {
      throw new Error('This age group is already selected for the user')
    }

    // Deactivate any existing active age groups for this user
    await prisma.userAgeGroup.updateMany({
      where: {
        userId,
        isActive: 1
      },
      data: {
        isActive: 0,
        updated_at: new Date()
      }
    })

    // Create new age group preference
    return await prisma.userAgeGroup.create({
      data: {
        userId,
        ageGroupId,
        isActive: 1
      }
    })
  }

  /**
   * Get user's active age group
   */
  async getUserAgeGroup(userId: bigint): Promise<(UserAgeGroup & { ageGroup: AgeGroup | null }) | null> {
    const userAgeGroup = await prisma.userAgeGroup.findFirst({
      where: {
        userId,
        isActive: 1
      },
      include: {
        ageGroup: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return userAgeGroup
  }

  /**
   * Get all age groups for a user (including inactive ones)
   */
  async getUserAgeGroupHistory(userId: bigint): Promise<(UserAgeGroup & { ageGroup: AgeGroup | null })[]> {
    return await prisma.userAgeGroup.findMany({
      where: {
        userId
      },
      include: {
        ageGroup: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  /**
   * Deactivate user's age group
   */
  async deactivateUserAgeGroup(userId: bigint): Promise<void> {
    const activeAgeGroup = await prisma.userAgeGroup.findFirst({
      where: {
        userId,
        isActive: 1
      }
    })

    if (!activeAgeGroup) {
      throw new Error('No active age group found for this user')
    }

    await prisma.userAgeGroup.update({
      where: {
        id: activeAgeGroup.id
      },
      data: {
        isActive: 0,
        updated_at: new Date()
      }
    })
  }
}

