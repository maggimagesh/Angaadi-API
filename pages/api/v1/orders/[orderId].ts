import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { OrderService } from '@/services/orderService'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user as { sub: string }
  const { orderId } = req.query
  const service = new OrderService()

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'orderId parameter is required' })
  }

  try {
    if (req.method === 'GET') {
      const order = await service.getOrder(user.sub, orderId)
      return res.status(200).json(serializeBigInt({ order }))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code = message === 'Order not found' ? 404 : message.startsWith('Invalid') ? 400 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
