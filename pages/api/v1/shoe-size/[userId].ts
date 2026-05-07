import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { ShoeSizeService } from '@/services/shoeSizeService'
import { serializeBigInt } from '@/utils/serialize'

const shoeSizeService = new ShoeSizeService()

function formatShoeSizeResponse(size: any) {
  if (!size) {
    return size
  }

  return {
    ...size,
    size: size.size !== null && size.size !== undefined ? Number(size.size) : size.size
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query

  try {
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

    let userIdBigInt: bigint

    try {
      userIdBigInt = BigInt(userId)
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid userId format',
        details: 'userId must be a valid number'
      })
    }

    if (userIdBigInt <= 0n) {
      return res.status(400).json({
        error: 'Invalid userId',
        details: 'userId must be a positive number'
      })
    }

    if (req.method === 'GET') {
      const userShoeSize = await shoeSizeService.getActiveUserShoeSize(userIdBigInt)

      if (!userShoeSize) {
        return res.status(404).json({
          error: 'Not found',
          details: 'No active shoe size found for this user'
        })
      }

      const formatted = {
        ...userShoeSize,
        shoeSize: userShoeSize.shoeSize ? formatShoeSizeResponse(userShoeSize.shoeSize) : null
      }

      return res.status(200).json(serializeBigInt({ userShoeSize: formatted }))
    }

    if (req.method === 'DELETE') {
      try {
        await shoeSizeService.deactivateUserShoeSize(userIdBigInt)
        return res.status(200).json({
          message: 'Shoe size selection removed successfully'
        })
      } catch (error: any) {
        if (error.message === 'No active shoe size found for this user') {
          return res.status(404).json({
            error: 'Not found',
            details: error.message
          })
        }

        throw error
      }
    }

    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['GET', 'DELETE']
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
