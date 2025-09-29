import type { NextApiRequest, NextApiResponse } from 'next'
import { GenderService } from '@/services/genderService'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const genderService = new GenderService()
    const genders = await genderService.getAllGenders()

    res.status(200).json(serializeBigInt({ genders }))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export default withAuth(handler)