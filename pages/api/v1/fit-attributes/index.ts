import type { NextApiRequest, NextApiResponse } from 'next'
import { FitAttributeService, UserFitAttributeInput } from '@/services/fitAttributeService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const fitAttributeService = new FitAttributeService()

  try {
    if (req.method === 'GET') {
      // Get all fit attributes with optional category filter
      const { category } = req.query

      // Validate category if provided
      if (category && typeof category !== 'string') {
        return res.status(400).json({ 
          error: 'Invalid category parameter',
          details: 'Category must be a string'
        })
      }

      if (category && !['mens', 'womens'].includes(category.toLowerCase())) {
        return res.status(400).json({ 
          error: 'Invalid category value',
          details: 'Category must be either "mens" or "womens"'
        })
      }

      const fitAttributes = await fitAttributeService.getAllFitAttributes(
        category ? category.toLowerCase() : undefined
      )

      return res.status(200).json(serializeBigInt({ fitAttributes }))
    } 
    
    else if (req.method === 'POST') {
      // Save user fit attributes (single or batch)
      const { userId, fitAttributeId, value, attributes } = req.body

      // Check if it's a batch save or single save
      if (attributes && Array.isArray(attributes)) {
        // Batch save
        if (!userId) {
          return res.status(400).json({ 
            error: 'Missing required fields',
            details: 'userId is required for batch save'
          })
        }

        // Validate userId
        if (isNaN(Number(userId)) || Number(userId) <= 0) {
          return res.status(400).json({ 
            error: 'Invalid userId',
            details: 'userId must be a positive number'
          })
        }

        // Validate attributes array
        if (attributes.length === 0) {
          return res.status(400).json({ 
            error: 'Invalid attributes',
            details: 'Attributes array cannot be empty'
          })
        }

        // Validate each attribute in the array
        for (const attr of attributes) {
          if (!attr.fitAttributeId || !attr.value) {
            return res.status(400).json({ 
              error: 'Invalid attribute',
              details: 'Each attribute must have fitAttributeId and value'
            })
          }

          if (isNaN(Number(attr.fitAttributeId)) || Number(attr.fitAttributeId) <= 0) {
            return res.status(400).json({ 
              error: 'Invalid fitAttributeId',
              details: 'fitAttributeId must be a positive number'
            })
          }

          if (typeof attr.value !== 'string' || attr.value.trim() === '') {
            return res.status(400).json({ 
              error: 'Invalid value',
              details: 'Value must be a non-empty string'
            })
          }
        }

        const savedAttributes = await fitAttributeService.batchSaveUserFitAttributes(
          userId,
          attributes
        )

        return res.status(200).json(serializeBigInt({ 
          userFitAttributes: savedAttributes,
          message: 'Fit attributes saved successfully'
        }))
      } else {
        // Single save
        if (!userId || !fitAttributeId || !value) {
          return res.status(400).json({ 
            error: 'Missing required fields',
            details: 'userId, fitAttributeId, and value are required'
          })
        }

        // Validate userId
        if (isNaN(Number(userId)) || Number(userId) <= 0) {
          return res.status(400).json({ 
            error: 'Invalid userId',
            details: 'userId must be a positive number'
          })
        }

        // Validate fitAttributeId
        if (isNaN(Number(fitAttributeId)) || Number(fitAttributeId) <= 0) {
          return res.status(400).json({ 
            error: 'Invalid fitAttributeId',
            details: 'fitAttributeId must be a positive number'
          })
        }

        // Validate value
        if (typeof value !== 'string' || value.trim() === '') {
          return res.status(400).json({ 
            error: 'Invalid value',
            details: 'Value must be a non-empty string'
          })
        }

        const input: UserFitAttributeInput = {
          userId,
          fitAttributeId,
          value,
        }

        const userFitAttribute = await fitAttributeService.saveUserFitAttribute(input)

        return res.status(200).json(serializeBigInt({ 
          userFitAttribute,
          message: 'Fit attribute saved successfully'
        }))
      }
    } 
    
    else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Fit attributes API error:', error)
    
    // Handle specific error cases
    if (error.message === 'Fit attribute not found') {
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

