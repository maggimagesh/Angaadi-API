import type { NextApiRequest, NextApiResponse } from 'next'
import { PreferredDepartmentService, PreferredDepartmentInput } from '@/services/preferredDepartmentService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, genderId }: PreferredDepartmentInput = req.body

    if (!userId || !genderId) {
      return res.status(400).json({ error: 'userId and genderId are required' })
    }

    const preferredDepartmentService = new PreferredDepartmentService()
    const preference = await preferredDepartmentService.createPreferredDepartment({
      userId,
      genderId,
    })

    res.status(200).json(serializeBigInt({ preference }))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export default withAuth(handler)