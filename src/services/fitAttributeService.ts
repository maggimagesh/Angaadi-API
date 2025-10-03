import prisma from '@/lib/prisma'

export interface FitAttribute {
  id: bigint
  name: string
  category: string
  displayOrder: number | null
  created_at: Date
  updated_at: Date | null
}

export interface UserFitAttributeInput {
  userId: string
  fitAttributeId: string
  value: string
}

export interface UserFitAttribute {
  id: bigint
  userId: bigint | null
  fitAttributeId: bigint | null
  value: string | null
  created_at: Date
  updated_at: Date | null
  isActive: number
  fitAttribute?: FitAttribute | null
}

export class FitAttributeService {
  /**
   * Get all fit attributes
   * @param category - Optional filter by category ('mens' or 'womens')
   */
  async getAllFitAttributes(category?: string): Promise<FitAttribute[]> {
    const where = category ? { category } : {}
    
    return await prisma.fitAttribute.findMany({
      where,
      orderBy: {
        displayOrder: 'asc',
      },
    })
  }

  /**
   * Get a single fit attribute by ID
   */
  async getFitAttributeById(id: string): Promise<FitAttribute | null> {
    const fitAttributeId = BigInt(id)
    
    return await prisma.fitAttribute.findUnique({
      where: { id: fitAttributeId },
    })
  }

  /**
   * Create or update a user fit attribute
   * If the user already has this attribute, update it; otherwise create new
   */
  async saveUserFitAttribute(input: UserFitAttributeInput): Promise<UserFitAttribute> {
    const userId = BigInt(input.userId)
    const fitAttributeId = BigInt(input.fitAttributeId)

    // Check if the fit attribute exists
    const fitAttribute = await prisma.fitAttribute.findUnique({
      where: { id: fitAttributeId },
    })

    if (!fitAttribute) {
      throw new Error('Fit attribute not found')
    }

    // Check if user already has this fit attribute
    const existingAttribute = await prisma.userFitAttribute.findFirst({
      where: {
        userId,
        fitAttributeId,
        isActive: 1,
      },
    })

    if (existingAttribute) {
      // Update existing attribute
      const updated = await prisma.userFitAttribute.update({
        where: { id: existingAttribute.id },
        data: {
          value: input.value,
          updated_at: new Date(),
        },
        include: {
          fitAttribute: true,
        },
      })

      return {
        id: updated.id,
        userId: updated.userId,
        fitAttributeId: updated.fitAttributeId,
        value: updated.value,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        isActive: updated.isActive,
        fitAttribute: updated.fitAttribute || null,
      }
    }

    // Create new attribute
    const result = await prisma.userFitAttribute.create({
      data: {
        userId,
        fitAttributeId,
        value: input.value,
        isActive: 1,
      },
      include: {
        fitAttribute: true,
      },
    })

    return {
      id: result.id,
      userId: result.userId,
      fitAttributeId: result.fitAttributeId,
      value: result.value,
      created_at: result.created_at,
      updated_at: result.updated_at,
      isActive: result.isActive,
      fitAttribute: result.fitAttribute || null,
    }
  }

  /**
   * Get all active fit attributes for a user
   */
  async getUserFitAttributes(userIdParam: string): Promise<UserFitAttribute[]> {
    const userId = BigInt(userIdParam)

    const results = await prisma.userFitAttribute.findMany({
      where: {
        userId,
        isActive: 1,
      },
      include: {
        fitAttribute: true,
      },
      orderBy: {
        fitAttribute: {
          displayOrder: 'asc',
        },
      },
    })

    return results.map((result) => ({
      id: result.id,
      userId: result.userId,
      fitAttributeId: result.fitAttributeId,
      value: result.value,
      created_at: result.created_at,
      updated_at: result.updated_at,
      isActive: result.isActive,
      fitAttribute: result.fitAttribute || null,
    }))
  }

  /**
   * Delete a specific user fit attribute
   */
  async deleteUserFitAttribute(userIdParam: string, fitAttributeIdParam: string): Promise<void> {
    const userId = BigInt(userIdParam)
    const fitAttributeId = BigInt(fitAttributeIdParam)

    const existingAttribute = await prisma.userFitAttribute.findFirst({
      where: {
        userId,
        fitAttributeId,
        isActive: 1,
      },
    })

    if (!existingAttribute) {
      throw new Error('User fit attribute not found')
    }

    await prisma.userFitAttribute.update({
      where: { id: existingAttribute.id },
      data: {
        isActive: 0,
        updated_at: new Date(),
      },
    })
  }

  /**
   * Delete all fit attributes for a user
   */
  async deleteAllUserFitAttributes(userIdParam: string): Promise<void> {
    const userId = BigInt(userIdParam)

    await prisma.userFitAttribute.updateMany({
      where: {
        userId,
        isActive: 1,
      },
      data: {
        isActive: 0,
        updated_at: new Date(),
      },
    })
  }

  /**
   * Batch save multiple fit attributes for a user
   */
  async batchSaveUserFitAttributes(
    userId: string,
    attributes: Array<{ fitAttributeId: string; value: string }>
  ): Promise<UserFitAttribute[]> {
    const results: UserFitAttribute[] = []

    for (const attr of attributes) {
      const saved = await this.saveUserFitAttribute({
        userId,
        fitAttributeId: attr.fitAttributeId,
        value: attr.value,
      })
      results.push(saved)
    }

    return results
  }
}

