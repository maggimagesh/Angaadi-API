import type { NextApiRequest, NextApiResponse } from 'next'
import { AgeGroupService } from '@/services/ageGroupService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ageGroupService = new AgeGroupService()
  const { userId } = req.query

  try {
    // Validation - Check if userId is provided
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'userId parameter is required and must be a valid number'
      })
    }

    const authUserId = String((req as { user?: { sub?: string } }).user?.sub || '')
    if (!authUserId || authUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Convert userId to BigInt
    let userIdBigInt: bigint
    try {
      userIdBigInt = BigInt(userId)
      if (userIdBigInt <= 0) {
        return res.status(400).json({
          error: 'Invalid userId',
          details: 'userId must be a positive number'
        })
      }
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid userId format',
        details: 'userId must be a valid number'
      })
    }

    // GET - Fetch user's active age group
    if (req.method === 'GET') {
      const userAgeGroup = await ageGroupService.getUserAgeGroup(userIdBigInt)

      if (!userAgeGroup) {
        return res.status(404).json({ 
          error: 'Not found',
          details: 'No active age group found for this user' 
        })
      }

      return res.status(200).json(serializeBigInt({ userAgeGroup }))
    }

    // DELETE - Deactivate user's age group
    if (req.method === 'DELETE') {
      try {
        await ageGroupService.deactivateUserAgeGroup(userIdBigInt)
        return res.status(200).json({ 
          message: 'Age group has been removed successfully' 
        })
      } catch (error: any) {
        if (error.message === 'No active age group found for this user') {
          return res.status(404).json({ 
            error: 'Not found',
            details: error.message 
          })
        }
        throw error
      }
    }

    // Method not allowed for other HTTP methods
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['GET', 'DELETE'] 
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

