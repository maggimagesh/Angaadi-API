import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { OrderService } from '@/services/orderService'

/** Hit when the buyer cancels or the PayPal popup errors before capture. */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = (req as any).user as { sub: string }
  const { orderId } = req.body || {}
  if (typeof orderId !== 'string' && typeof orderId !== 'number') {
    return res.status(400).json({ error: 'orderId is required' })
  }

  const orderService = new OrderService()

  try {
    const order = await orderService.getOrder(user.sub, String(orderId))
    if (order.status === 'paid') {
      return res.status(409).json({ error: 'Order is already paid' })
    }
    const updated = await orderService.markFailed(order.id)
    return res.status(200).json(serializeBigInt({ order: updated }))
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code = message === 'Order not found' ? 404 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
