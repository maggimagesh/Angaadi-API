import prisma from '@/lib/prisma'

export interface FitAttribute {
  id: number
  attributeName: string
  optionValue: string
}

export interface UserFitAttributesInput {
  userId: string
  shouldersId?: string
  waistId?: string
  thighsId?: string
  hipsId?: string
}

export interface UserFitAttributesArrayInput {
  userId: string
  fitAttributeIds: number[]
}

export interface UserFitAttributesResponse {
  id: number
  userId: bigint
  shoulderId: number | null
  waistId: number | null
  thighsId: number | null
  hipsId: number | null
  created_at: Date | null
  updated_at: Date | null
  shoulder?: FitAttribute | null
  waist?: FitAttribute | null
  thighs?: FitAttribute | null
  hips?: FitAttribute | null
}

export interface FitAttributeOption {
  id: number
  value: string
}

export interface FitAttributeGrouped {
  attributeName: string
  options: FitAttributeOption[]
}

export class FitAttributeService {
  /**
   * Get all fit attributes
   * @param attributeName - Optional filter by attribute name (e.g., 'Shoulders', 'Waist', 'Thighs/Legs', 'Hips')
   */
  async getAllFitAttributes(attributeName?: string): Promise<FitAttribute[]> {
    const where = attributeName ? { attributeName: attributeName } : {}
    
    return await prisma.fitAttribute.findMany({
      where,
      orderBy: {
        id: 'asc',
      },
    })
  }

  /**
   * Get fit attributes grouped by attribute name
   */
  async getFitAttributesGrouped(): Promise<Record<string, FitAttribute[]>> {
    const attributes = await prisma.fitAttribute.findMany({
      orderBy: {
        id: 'asc',
      },
    })

    const grouped: Record<string, FitAttribute[]> = {}
    
    for (const attr of attributes) {
      if (!grouped[attr.attributeName]) {
        grouped[attr.attributeName] = []
      }
      grouped[attr.attributeName].push(attr)
    }

    return grouped
  }

  /**
   * Get fit attributes in array format with grouped options
   */
  async getFitAttributesFormatted(): Promise<FitAttributeGrouped[]> {
    const attributes = await prisma.fitAttribute.findMany({
      orderBy: {
        id: 'asc',
      },
    })

    const grouped: Record<string, FitAttributeOption[]> = {}
    
    for (const attr of attributes) {
      if (!grouped[attr.attributeName]) {
        grouped[attr.attributeName] = []
      }
      grouped[attr.attributeName].push({
        id: Number(attr.id),
        value: attr.optionValue
      })
    }

    return Object.entries(grouped).map(([attributeName, options]) => ({
      attributeName,
      options
    }))
  }

  /**
   * Get a single fit attribute by ID
   */
  async getFitAttributeById(id: string): Promise<FitAttribute | null> {
    const fitAttributeId = parseInt(id)
    
    return await prisma.fitAttribute.findUnique({
      where: { id: fitAttributeId },
    })
  }

  /**
   * Save or update user fit attributes using array format
   * Array order: [shouldersId, waistId, thighsId, hipsId]
   */
  async saveUserFitAttributesArray(input: UserFitAttributesArrayInput): Promise<UserFitAttributesResponse> {
    const userId = BigInt(input.userId)

    // Validate fitAttributeIds array
    if (!input.fitAttributeIds || !Array.isArray(input.fitAttributeIds)) {
      throw new Error('fitAttributeIds must be an array')
    }

    if (input.fitAttributeIds.length !== 4) {
      throw new Error('fitAttributeIds must contain exactly 4 elements [shouldersId, waistId, thighsId, hipsId]')
    }

    // Extract IDs from array (order: shoulders, waist, thighs, hips)
    const [shoulderId, waistId, thighsId, hipsId] = input.fitAttributeIds

    // Validate that all IDs are provided and are numbers
    if (!shoulderId || !waistId || !thighsId || !hipsId) {
      throw new Error('All four fit attribute IDs must be provided')
    }

    // Validate that all provided IDs exist in the fitattribute table
    const attributePromises = [
      prisma.fitAttribute.findUnique({ where: { id: shoulderId } }),
      prisma.fitAttribute.findUnique({ where: { id: waistId } }),
      prisma.fitAttribute.findUnique({ where: { id: thighsId } }),
      prisma.fitAttribute.findUnique({ where: { id: hipsId } }),
    ]

    const [shoulderAttr, waistAttr, thighsAttr, hipsAttr] = await Promise.all(attributePromises)

    if (!shoulderAttr) throw new Error('Invalid shoulder fit attribute ID')
    if (!waistAttr) throw new Error('Invalid waist fit attribute ID')
    if (!thighsAttr) throw new Error('Invalid thighs fit attribute ID')
    if (!hipsAttr) throw new Error('Invalid hips fit attribute ID')

    // Check if user already has fit attributes
    const existingAttributes = await prisma.userFitAttributes.findFirst({
      where: { 
        userId: userId,
        isActive: true,
      },
    })

    if (existingAttributes) {
      // Update existing attributes
      const updated = await prisma.userFitAttributes.update({
        where: { id: existingAttributes.id },
        data: {
          shoulderId,
          waistId,
          thighsId,
          hipsId,
          updated_at: new Date(),
        },
        include: {
          fitAttribute_userFitAttributes_shoulderIdTofitAttribute: true,
          fitAttribute_userFitAttributes_waistIdTofitAttribute: true,
          fitAttribute_userFitAttributes_thighsIdTofitAttribute: true,
          fitAttribute_userFitAttributes_hipsIdTofitAttribute: true,
        },
      })

      return {
        id: updated.id,
        userId: updated.userId,
        shoulderId: updated.shoulderId,
        waistId: updated.waistId,
        thighsId: updated.thighsId,
        hipsId: updated.hipsId,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        shoulder: updated.fitAttribute_userFitAttributes_shoulderIdTofitAttribute || null,
        waist: updated.fitAttribute_userFitAttributes_waistIdTofitAttribute || null,
        thighs: updated.fitAttribute_userFitAttributes_thighsIdTofitAttribute || null,
        hips: updated.fitAttribute_userFitAttributes_hipsIdTofitAttribute || null,
      }
    }

    // Create new attributes
    const result = await prisma.userFitAttributes.create({
      data: {
        userId: userId,
        shoulderId,
        waistId,
        thighsId,
        hipsId,
      },
      include: {
        fitAttribute_userFitAttributes_shoulderIdTofitAttribute: true,
        fitAttribute_userFitAttributes_waistIdTofitAttribute: true,
        fitAttribute_userFitAttributes_thighsIdTofitAttribute: true,
        fitAttribute_userFitAttributes_hipsIdTofitAttribute: true,
      },
    })

    return {
      id: result.id,
      userId: result.userId,
      shoulderId: result.shoulderId,
      waistId: result.waistId,
      thighsId: result.thighsId,
      hipsId: result.hipsId,
      created_at: result.created_at,
      updated_at: result.updated_at,
      shoulder: result.fitAttribute_userFitAttributes_shoulderIdTofitAttribute || null,
      waist: result.fitAttribute_userFitAttributes_waistIdTofitAttribute || null,
      thighs: result.fitAttribute_userFitAttributes_thighsIdTofitAttribute || null,
      hips: result.fitAttribute_userFitAttributes_hipsIdTofitAttribute || null,
    }
  }

  /**
   * Save or update user fit attributes
   * If the user already has fit attributes, update them; otherwise create new
   */
  async saveUserFitAttributes(input: UserFitAttributesInput): Promise<UserFitAttributesResponse> {
    const userId = BigInt(input.userId)

    // Convert IDs to integers
    const shoulderId = input.shouldersId ? parseInt(input.shouldersId) : null
    const waistId = input.waistId ? parseInt(input.waistId) : null
    const thighsId = input.thighsId ? parseInt(input.thighsId) : null
    const hipsId = input.hipsId ? parseInt(input.hipsId) : null

    // Validate that at least one attribute is provided
    if (!shoulderId && !waistId && !thighsId && !hipsId) {
      throw new Error('At least one fit attribute must be provided')
    }

    // Validate that all provided IDs exist in the fitattribute table
    if (shoulderId) {
      const shoulderAttr = await prisma.fitAttribute.findUnique({
        where: { id: shoulderId },
      })
      if (!shoulderAttr) {
        throw new Error('Invalid shoulder fit attribute ID')
      }
    }

    if (waistId) {
      const waistAttr = await prisma.fitAttribute.findUnique({
        where: { id: waistId },
      })
      if (!waistAttr) {
        throw new Error('Invalid waist fit attribute ID')
      }
    }

    if (thighsId) {
      const thighsAttr = await prisma.fitAttribute.findUnique({
        where: { id: thighsId },
      })
      if (!thighsAttr) {
        throw new Error('Invalid thighs fit attribute ID')
      }
    }

    if (hipsId) {
      const hipsAttr = await prisma.fitAttribute.findUnique({
        where: { id: hipsId },
      })
      if (!hipsAttr) {
        throw new Error('Invalid hips fit attribute ID')
      }
    }

    // Check if user already has fit attributes
    const existingAttributes = await prisma.userFitAttributes.findFirst({
      where: {
        userId: userId,
        isActive: true,
      },
    })

    if (existingAttributes) {
      // Update existing attributes
      const updated = await prisma.userFitAttributes.update({
        where: { id: existingAttributes.id },
        data: {
          shoulderId: shoulderId ?? existingAttributes.shoulderId,
          waistId: waistId ?? existingAttributes.waistId,
          thighsId: thighsId ?? existingAttributes.thighsId,
          hipsId: hipsId ?? existingAttributes.hipsId,
          updated_at: new Date(),
        },
        include: {
          fitAttribute_userFitAttributes_shoulderIdTofitAttribute: true,
          fitAttribute_userFitAttributes_waistIdTofitAttribute: true,
          fitAttribute_userFitAttributes_thighsIdTofitAttribute: true,
          fitAttribute_userFitAttributes_hipsIdTofitAttribute: true,
        },
      })

      return {
        id: updated.id,
        userId: updated.userId,
        shoulderId: updated.shoulderId,
        waistId: updated.waistId,
        thighsId: updated.thighsId,
        hipsId: updated.hipsId,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        shoulder: updated.fitAttribute_userFitAttributes_shoulderIdTofitAttribute || null,
        waist: updated.fitAttribute_userFitAttributes_waistIdTofitAttribute || null,
        thighs: updated.fitAttribute_userFitAttributes_thighsIdTofitAttribute || null,
        hips: updated.fitAttribute_userFitAttributes_hipsIdTofitAttribute || null,
      }
    }

    // Create new attributes
    const result = await prisma.userFitAttributes.create({
      data: {
        userId: userId,
        shoulderId: shoulderId,
        waistId: waistId,
        thighsId: thighsId,
        hipsId: hipsId,
      },
      include: {
        fitAttribute_userFitAttributes_shoulderIdTofitAttribute: true,
        fitAttribute_userFitAttributes_waistIdTofitAttribute: true,
        fitAttribute_userFitAttributes_thighsIdTofitAttribute: true,
        fitAttribute_userFitAttributes_hipsIdTofitAttribute: true,
      },
    })

    return {
      id: result.id,
      userId: result.userId,
      shoulderId: result.shoulderId,
      waistId: result.waistId,
      thighsId: result.thighsId,
      hipsId: result.hipsId,
      created_at: result.created_at,
      updated_at: result.updated_at,
      shoulder: result.fitAttribute_userFitAttributes_shoulderIdTofitAttribute || null,
      waist: result.fitAttribute_userFitAttributes_waistIdTofitAttribute || null,
      thighs: result.fitAttribute_userFitAttributes_thighsIdTofitAttribute || null,
      hips: result.fitAttribute_userFitAttributes_hipsIdTofitAttribute || null,
    }
  }

  /**
   * Get fit attributes for a user (only returns active records where isActive = true)
   */
  async getUserFitAttributes(userIdParam: string): Promise<UserFitAttributesResponse | null> {
    const userId = BigInt(userIdParam)

    const result = await prisma.userFitAttributes.findFirst({
      where: {
        userId: userId,
        isActive: true,
      },
      include: {
        fitAttribute_userFitAttributes_shoulderIdTofitAttribute: true,
        fitAttribute_userFitAttributes_waistIdTofitAttribute: true,
        fitAttribute_userFitAttributes_thighsIdTofitAttribute: true,
        fitAttribute_userFitAttributes_hipsIdTofitAttribute: true,
      },
    })

    if (!result) {
      return null
    }

    return {
      id: result.id,
      userId: result.userId,
      shoulderId: result.shoulderId,
      waistId: result.waistId,
      thighsId: result.thighsId,
      hipsId: result.hipsId,
      created_at: result.created_at,
      updated_at: result.updated_at,
      shoulder: result.fitAttribute_userFitAttributes_shoulderIdTofitAttribute || null,
      waist: result.fitAttribute_userFitAttributes_waistIdTofitAttribute || null,
      thighs: result.fitAttribute_userFitAttributes_thighsIdTofitAttribute || null,
      hips: result.fitAttribute_userFitAttributes_hipsIdTofitAttribute || null,
    }
  }

  /**
   * Delete fit attributes for a user (soft delete by setting isActive to false)
   */
  async deleteUserFitAttributes(userIdParam: string): Promise<void> {
    const userId = BigInt(userIdParam)

    const existingAttributes = await prisma.userFitAttributes.findFirst({
      where: {
        userId: userId,
        isActive: true,
      },
    })

    if (!existingAttributes) {
      throw new Error('User fit attributes not found')
    }

    await prisma.userFitAttributes.update({
      where: { id: existingAttributes.id },
      data: {
        isActive: false,
        updated_at: new Date(),
      },
    })
  }
}
