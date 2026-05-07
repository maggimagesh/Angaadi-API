import type { NextApiRequest, NextApiResponse } from 'next'
import { FitAttributeService } from '@/services/fitAttributeService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query
  const fitAttributeService = new FitAttributeService()

  // Validate userId
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      error: 'Invalid userId',
      details: 'userId is required and must be a string'
    })
  }

  if (isNaN(Number(userId)) || Number(userId) <= 0) {
    return res.status(400).json({
      error: 'Invalid userId',
      details: 'userId must be a positive number'
    })
  }

  const authUserId = String((req as { user?: { sub?: string } }).user?.sub || '')
  if (!authUserId || authUserId !== userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    if (req.method === 'GET') {
      // Get fit attributes for a user
      const userFitAttributes = await fitAttributeService.getUserFitAttributes(userId)

      if (!userFitAttributes) {
        return res.status(404).json({ 
          error: 'Not found',
          details: 'No fit attributes found for this user'
        })
      }

      return res.status(200).json(serializeBigInt({ userFitAttributes }))
    } 
    
    else if (req.method === 'DELETE') {
      // Delete fit attributes for a user
      await fitAttributeService.deleteUserFitAttributes(userId)
      
      return res.status(200).json({ 
        message: 'Fit attributes have been removed successfully'
      })
    } 
    
    else if (req.method === 'PUT' || req.method === 'PATCH') {
      // Update fit attributes for a user
      const { shouldersId, waistId, thighsId, hipsId } = req.body

      // Validate that at least one attribute is provided
      if (!shouldersId && !waistId && !thighsId && !hipsId) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          details: 'At least one fit attribute (shouldersId, waistId, thighsId, or hipsId) must be provided'
        })
      }

      // Validate provided IDs
      if (shouldersId && (isNaN(Number(shouldersId)) || Number(shouldersId) <= 0)) {
        return res.status(400).json({ 
          error: 'Invalid shouldersId',
          details: 'shouldersId must be a positive number'
        })
      }

      if (waistId && (isNaN(Number(waistId)) || Number(waistId) <= 0)) {
        return res.status(400).json({ 
          error: 'Invalid waistId',
          details: 'waistId must be a positive number'
        })
      }

      if (thighsId && (isNaN(Number(thighsId)) || Number(thighsId) <= 0)) {
        return res.status(400).json({ 
          error: 'Invalid thighsId',
          details: 'thighsId must be a positive number'
        })
      }

      if (hipsId && (isNaN(Number(hipsId)) || Number(hipsId) <= 0)) {
        return res.status(400).json({ 
          error: 'Invalid hipsId',
          details: 'hipsId must be a positive number'
        })
      }

      const userFitAttributes = await fitAttributeService.saveUserFitAttributes({
        userId,
        shouldersId,
        waistId,
        thighsId,
        hipsId,
      })

      return res.status(200).json(serializeBigInt({ 
        userFitAttributes,
        message: 'Fit attributes updated successfully'
      }))
    } 
    
    else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Fit attributes API error:', error)
    
    // Handle specific error cases
    if (error.message === 'User fit attributes not found') {
      return res.status(404).json({ 
        error: 'Not found',
        details: error.message
      })
    }

    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({ 
        error: 'Bad request',
        details: error.message
      })
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    })
  }
}

export default withAuth(handler)
