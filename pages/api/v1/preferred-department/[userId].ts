import type { NextApiRequest, NextApiResponse } from 'next'
import { PreferredDepartmentService } from '@/services/preferredDepartmentService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' })
  }

  try {
    const preferredDepartmentService = new PreferredDepartmentService()
    
    if (req.method === 'GET') {
      const preference = await preferredDepartmentService.getLatestPreferredDepartmentByUserId(userId)
      return res.status(200).json(serializeBigInt({ preference: preference ?? {} }))
    } else if (req.method === 'PUT') {
      await preferredDepartmentService.deactivateByUserId(userId)
      return res.status(200).json({ message: 'The gender has been removed successfully' })
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export default withAuth(handler)