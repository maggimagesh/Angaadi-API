import type { NextApiRequest, NextApiResponse } from 'next'
import { PhysicalStatsService, PhysicalStatsInput } from '@/services/physicalStatsService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Extract user from request (added by withAuth middleware)
  const userId = BigInt((req as any).user.sub)

  try {
    if (req.method === 'POST') {
      // Handle storing physical stats
      const { heightUnit, weightUnit, heightValue, weightValue }: PhysicalStatsInput = req.body

      if (!heightUnit || !weightUnit || heightValue === undefined || weightValue === undefined) {
        return res.status(400).json({ error: 'Missing required fields: heightUnit, weightUnit, heightValue, weightValue' })
      }

      if (!['cm', 'ft'].includes(heightUnit) || !['kg', 'lb'].includes(weightUnit)) {
        return res.status(400).json({ error: 'Invalid units. Height unit must be "cm" or "ft". Weight unit must be "kg" or "lb".' })
      }

      if (typeof heightValue !== 'number' || typeof weightValue !== 'number') {
        return res.status(400).json({ error: 'Height and weight values must be numbers' })
      }

      const physicalStatsService = new PhysicalStatsService()
      const stats = await physicalStatsService.createPhysicalStats(userId, {
        heightUnit,
        weightUnit,
        heightValue,
        weightValue,
      })

      return res.status(201).json(serializeBigInt({ stats }))
    } else if (req.method === 'GET') {
      // Handle retrieving physical stats
      const physicalStatsService = new PhysicalStatsService()
      const stats = await physicalStatsService.getLatestPhysicalStats(userId)

      return res.status(200).json(serializeBigInt({ stats: stats ?? null }))
    } else if (req.method === 'DELETE') {
      // Handle deleting physical stats
      try {
        const physicalStatsService = new PhysicalStatsService()
        await physicalStatsService.deletePhysicalStats(userId)
        return res.status(200).json({ message: 'Physical stats deleted successfully' })
      } catch (error: any) {
        if (error.message === 'No physical stats found for this user') {
          return res.status(404).json({
            error: 'Not found',
            details: error.message
          })
        }
        throw error
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export default withAuth(handler)