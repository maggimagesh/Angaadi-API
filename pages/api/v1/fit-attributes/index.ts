import type { NextApiRequest, NextApiResponse } from 'next'
import { FitAttributeService, UserFitAttributesArrayInput, FitAttributeGrouped } from '@/services/fitAttributeService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fitAttributeService = new FitAttributeService()

  try {
    if (req.method === 'GET') {
      // Get all fit attributes - returns formatted grouped data by default
      const data = await fitAttributeService.getFitAttributesFormatted()
      return res.status(200).json(serializeBigInt({ data }))
    } 
    
    else if (req.method === 'POST') {
      // Save user fit attributes
      const { userId, fitAttributeIds } = req.body

      // Validate userId
      if (!userId) {
        return res.status(400).json({ 
          error: 'Missing required field',
          details: 'userId is required'
        })
      }

      if (isNaN(Number(userId)) || Number(userId) <= 0) {
        return res.status(400).json({ 
          error: 'Invalid userId',
          details: 'userId must be a positive number'
        })
      }

      // Validate fitAttributeIds
      if (!fitAttributeIds) {
        return res.status(400).json({ 
          error: 'Missing required field',
          details: 'fitAttributeIds is required'
        })
      }

      if (!Array.isArray(fitAttributeIds)) {
        return res.status(400).json({ 
          error: 'Invalid fitAttributeIds',
          details: 'fitAttributeIds must be an array'
        })
      }

      if (fitAttributeIds.length !== 4) {
        return res.status(400).json({ 
          error: 'Invalid fitAttributeIds',
          details: 'fitAttributeIds must contain exactly 4 elements [shouldersId, waistId, thighsId, hipsId]'
        })
      }

      // Validate that all IDs are positive numbers
      for (let i = 0; i < fitAttributeIds.length; i++) {
        if (isNaN(Number(fitAttributeIds[i])) || Number(fitAttributeIds[i]) <= 0) {
          const attributeNames = ['shoulders', 'waist', 'thighs', 'hips']
          return res.status(400).json({ 
            error: `Invalid ${attributeNames[i]} ID`,
            details: `fitAttributeIds[${i}] must be a positive number`
          })
        }
      }

      const input: UserFitAttributesArrayInput = {
        userId: userId.toString(),
        fitAttributeIds: fitAttributeIds.map(Number),
      }

      const userFitAttributes = await fitAttributeService.saveUserFitAttributesArray(input)

      return res.status(201).json(serializeBigInt({ 
        userFitAttributes,
        message: 'Fit attributes saved successfully'
      }))
    } 
    
    else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Fit attributes API error:', error)
    
    // Handle specific error cases
    if (error.message.includes('not found') || error.message.includes('Invalid')) {
      return res.status(404).json({ 
        error: 'Not found',
        details: error.message
      })
    }

    if (error.message.includes('required') || error.message.includes('must be provided')) {
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
