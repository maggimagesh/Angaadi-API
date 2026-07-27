import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { OrderService } from '@/services/orderService'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user as { sub: string }
  const service = new OrderService()

  try {
    if (req.method === 'GET') {
      const orders = await service.listOrders(user.sub)
      return res.status(200).json(serializeBigInt({ orders }))
    }

    if (req.method === 'POST') {
      const { addressId, deliverySlot, paymentMethod, deliveryFee } = req.body || {}
      if (typeof addressId !== 'string' && typeof addressId !== 'number') {
        return res.status(400).json({ error: 'addressId is required' })
      }
      const order = await service.createOrder(user.sub, {
        addressId: String(addressId),
        deliverySlot,
        paymentMethod,
        deliveryFee,
      })
      return res.status(201).json(serializeBigInt({ order }))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code =
      message === 'Address not found' || message === 'Cart is empty' || message.startsWith('Invalid')
        ? 400
        : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
