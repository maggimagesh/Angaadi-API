import type { NextApiRequest, NextApiResponse } from 'next'
import { AgeGroupService, UserAgeGroupInput } from '@/services/ageGroupService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ageGroupService = new AgeGroupService()

  try {
    // GET - Fetch all age groups
    if (req.method === 'GET') {
      const ageGroups = await ageGroupService.getAllAgeGroups()
      return res.status(200).json(serializeBigInt({ ageGroups }))
    }

    // POST - Save user's age group
    if (req.method === 'POST') {
      const { userId, ageGroupId } = req.body

      // Validation - Check if required fields are present
      if (userId === undefined || userId === null || ageGroupId === undefined || ageGroupId === null) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          details: 'userId and ageGroupId are required' 
        })
      }

      // Validation - Check if IDs are valid numbers and convert to BigInt
      let userIdBigInt: bigint
      let ageGroupIdBigInt: bigint

      try {
        userIdBigInt = typeof userId === 'string' ? BigInt(userId) : BigInt(userId)
        ageGroupIdBigInt = typeof ageGroupId === 'string' ? BigInt(ageGroupId) : BigInt(ageGroupId)
      } catch (conversionError) {
        return res.status(400).json({ 
          error: 'Invalid input format',
          details: 'userId and ageGroupId must be valid numbers' 
        })
      }

      if (userIdBigInt <= 0 || ageGroupIdBigInt <= 0) {
        return res.status(400).json({ 
          error: 'Invalid input',
          details: 'userId and ageGroupId must be positive numbers' 
        })
      }

      const input: UserAgeGroupInput = {
        userId: userIdBigInt,
        ageGroupId: ageGroupIdBigInt,
      }

      try {
        const userAgeGroup = await ageGroupService.saveUserAgeGroup(input)
        return res.status(201).json(serializeBigInt({ 
          userAgeGroup,
          message: 'Age group saved successfully' 
        }))
      } catch (error: any) {
        // Handle specific business logic errors
        if (error.message === 'Invalid age group ID') {
          return res.status(404).json({ 
            error: 'Age group not found',
            details: error.message 
          })
        }
        if (error.message === 'Invalid user ID') {
          return res.status(404).json({ 
            error: 'User not found',
            details: error.message 
          })
        }
        if (error.message === 'This age group is already selected for the user') {
          return res.status(409).json({ 
            error: 'Conflict',
            details: error.message 
          })
        }
        throw error
      }
    }

    // Method not allowed for other HTTP methods
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST'] 
    })

  } catch (error: any) {
    console.error('Age group API error:', error)
    
    // Generic server error
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred' 
    })
  }
}

export default withAuth(handler)

