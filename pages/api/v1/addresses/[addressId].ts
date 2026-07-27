import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { AddressService } from '@/services/addressService'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user as { sub: string }
  const { addressId } = req.query
  const service = new AddressService()

  if (!addressId || typeof addressId !== 'string') {
    return res.status(400).json({ error: 'addressId parameter is required' })
  }

  try {
    if (req.method === 'GET') {
      const address = await service.getAddress(user.sub, addressId)
      return res.status(200).json(serializeBigInt({ address }))
    }

    if (req.method === 'PUT') {
      const address = await service.updateAddress(user.sub, addressId, req.body || {})
      return res.status(200).json(serializeBigInt({ address }))
    }

    if (req.method === 'PATCH') {
      const address = await service.setDefault(user.sub, addressId)
      return res.status(200).json(serializeBigInt({ address }))
    }

    if (req.method === 'DELETE') {
      const addresses = await service.deleteAddress(user.sub, addressId)
      return res.status(200).json(serializeBigInt({ addresses }))
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
      'Invalid address id',
    ]
    const code = message === 'Address not found' ? 404 : knownBadInput.includes(message) ? 400 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
