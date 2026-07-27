import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { AddressService } from '@/services/addressService'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user as { sub: string }
  const service = new AddressService()

  try {
    if (req.method === 'GET') {
      const addresses = await service.listAddresses(user.sub)
      return res.status(200).json(serializeBigInt({ addresses }))
    }

    if (req.method === 'POST') {
      const address = await service.createAddress(user.sub, req.body || {})
      return res.status(201).json(serializeBigInt({ address }))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const knownBadInput = [
      'Full name is required',
      'Enter a valid phone number',
      'Address line 1 is required',
      'City is required',
      'State is required',
      'Pin code must be six digits',
      'Invalid user id',
    ]
    const code = knownBadInput.includes(message) ? 400 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
