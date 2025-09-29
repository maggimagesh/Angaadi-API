import prisma from '@/lib/prisma'

export interface PhysicalStatsInput {
  heightUnit: 'cm' | 'ft'
  weightUnit: 'kg' | 'lb'
  heightValue: number
  weightValue: number
}

export interface PhysicalStats {
  id: bigint
  userId: bigint
  heightCm?: number | null
  heightFt?: number | null
  weightKg?: number | null
  weightLb?: number | null  // Using the updated database field name
  created_at: Date
  updated_at: Date | null
}

export class PhysicalStatsService {
  async createPhysicalStats(userId: bigint, input: PhysicalStatsInput): Promise<PhysicalStats> {
    // Prepare data based on selected units
    let heightCm: number | null = null
    let heightFt: number | null = null
    let weightKg: number | null = null
    let weightLb: number | null = null  // Using the updated database field name

    if (input.heightUnit === 'cm') {
      heightCm = input.heightValue
    } else if (input.heightUnit === 'ft') {
      heightFt = input.heightValue
    }

    if (input.weightUnit === 'kg') {
      weightKg = input.weightValue
    } else if (input.weightUnit === 'lb') {
      weightLb = input.weightValue  // Using the updated database field name (weightLb for lbs)
    }

    // Check if a record already exists for this user
    const existingRecord = await prisma.userPhysicalStats.findFirst({
      where: { userId },
      orderBy: { created_at: 'desc' },
    });

    let stats;
    if (existingRecord) {
      // Update the existing record
      stats = await prisma.userPhysicalStats.update({
        where: { id: existingRecord.id },
        data: {
          heightCm,
          heightFt,
          weightKg,
          weightLb: weightLb,
          updated_at: new Date()
        }
      });
    } else {
      // Create a new record
      stats = await prisma.userPhysicalStats.create({
        data: {
          userId,
          heightCm,
          heightFt,
          weightKg,
          weightLb: weightLb
        }
      });
    }

    // Make sure to return the correct type by ensuring userId is not null
    return {
      ...stats,
      userId: stats.userId! // We know userId is not null since we provided it in create/update
    }
  }

  async getLatestPhysicalStats(userId: bigint): Promise<PhysicalStats | null> {
    const record = await prisma.userPhysicalStats.findFirst({
      where: {
        userId,
      },
      orderBy: {
        created_at: 'desc',
      },
    })
    
    // Return null if not found, otherwise cast with proper userId
    if (!record) return null
    
    return {
      ...record,
      userId: record.userId!
    }
  }
}