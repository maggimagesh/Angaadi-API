import type { NextApiRequest, NextApiResponse } from 'next'
import { FitAttributeService } from '@/services/fitAttributeService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, fitAttributeId } = req.query
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

  try {
    if (req.method === 'GET') {
      // Get all fit attributes for a user
      const userFitAttributes = await fitAttributeService.getUserFitAttributes(userId)

      if (userFitAttributes.length === 0) {
        return res.status(404).json({ 
          error: 'Not found',
          details: 'No fit attributes found for this user'
        })
      }

      return res.status(200).json(serializeBigInt({ userFitAttributes }))
    } 
    
    else if (req.method === 'DELETE') {
      // Delete fit attribute(s) for a user
      if (fitAttributeId && typeof fitAttributeId === 'string') {
        // Delete a specific fit attribute
        if (isNaN(Number(fitAttributeId)) || Number(fitAttributeId) <= 0) {
          return res.status(400).json({ 
            error: 'Invalid fitAttributeId',
            details: 'fitAttributeId must be a positive number'
          })
        }

        await fitAttributeService.deleteUserFitAttribute(userId, fitAttributeId)
        
        return res.status(200).json({ 
          message: 'Fit attribute has been removed successfully'
        })
      } else {
        // Delete all fit attributes for the user
        await fitAttributeService.deleteAllUserFitAttributes(userId)
        
        return res.status(200).json({ 
          message: 'All fit attributes have been removed successfully'
        })
      }
    } 
    
    else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Fit attributes API error:', error)
    
    // Handle specific error cases
    if (error.message === 'User fit attribute not found') {
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

