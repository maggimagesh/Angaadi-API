import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { ShoeSizeService, UserShoeSizeInput } from '@/services/shoeSizeService'
import { serializeBigInt } from '@/utils/serialize'

const shoeSizeService = new ShoeSizeService()

function formatShoeSizeResponse(size: any) {
  if (!size) return size

  return {
    ...size,
    size: size.size !== null && size.size !== undefined ? Number(size.size) : size.size
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const shoeSizes = await shoeSizeService.getAllShoeSizes()
      
      // Extract unique sizes and widths
      const uniqueSizes = [...new Set(shoeSizes.map(s => Number(s.size)))].sort((a, b) => a - b)
      const uniqueWidths = [...new Set(shoeSizes.map(s => s.width))].sort()
      
      return res.status(200).json({
        shoeSizes: uniqueSizes,
        widths: uniqueWidths
      })
    }

    if (req.method === 'POST') {
      const { userId, size, width } = req.body

      if (userId === undefined || userId === null || size === undefined || size === null || !width) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'userId, size, and width are required'
        })
      }

      let userIdBigInt: bigint
      let sizeNumber: number

      try {
        userIdBigInt = typeof userId === 'string' ? BigInt(userId) : BigInt(userId)
        sizeNumber = typeof size === 'string' ? Number(size) : Number(size)
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid input format',
          details: 'userId and size must be valid numbers'
        })
      }

      if (userIdBigInt <= 0n || sizeNumber <= 0) {
        return res.status(400).json({
          error: 'Invalid input',
          details: 'userId and size must be positive'
        })
      }

      // Find the shoe size ID based on size and width
      const shoeSize = await shoeSizeService.getShoeSizeBySizeAndWidth(sizeNumber, width)
      if (!shoeSize) {
        return res.status(404).json({
          error: 'Shoe size not found',
          details: `No shoe size found with size ${sizeNumber} and width ${width}`
        })
      }

      const input: UserShoeSizeInput = {
        userId: userIdBigInt,
        shoeSizeId: shoeSize.id
      }

      try {
        const userShoeSize = await shoeSizeService.saveUserShoeSize(input)
        const formatted = {
          ...userShoeSize,
          shoeSize: userShoeSize.shoeSize ? formatShoeSizeResponse(userShoeSize.shoeSize) : null
        }

        return res.status(201).json(serializeBigInt({
          userShoeSize: formatted,
          message: 'Shoe size saved successfully'
        }))
      } catch (error: any) {
        if (error.message === 'Invalid shoe size ID') {
          return res.status(404).json({
            error: 'Shoe size not found',
            details: error.message
          })
        }

        if (error.message === 'Invalid user ID') {
          return res.status(404).json({
            error: 'User not found',
            details: error.message
          })
        }

        if (error.message === 'This shoe size is already active for the user') {
          return res.status(409).json({
            error: 'Conflict',
            details: error.message
          })
        }

        throw error
      }
    }

    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST']
    })
  } catch (error: any) {
    console.error('Shoe size API error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    })
  }
}

export default withAuth(handler)
