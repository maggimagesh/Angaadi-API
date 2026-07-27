import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { OrderService } from '@/services/orderService'
import { PaypalService } from '@/services/paypalService'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = (req as any).user as { sub: string }
  const { orderId, paypalOrderId } = req.body || {}
  if ((typeof orderId !== 'string' && typeof orderId !== 'number') || typeof paypalOrderId !== 'string') {
    return res.status(400).json({ error: 'orderId and paypalOrderId are required' })
  }

  const orderService = new OrderService()
  const paypalService = new PaypalService()

  try {
    const order = await orderService.getOrder(user.sub, String(orderId))
    if (order.paypalOrderId !== paypalOrderId) {
      return res.status(409).json({ error: 'Payment session does not match this order' })
    }
    if (order.status === 'paid') {
      return res.status(200).json(serializeBigInt({ order }))
    }

    try {
      const { captureId } = await paypalService.captureOrder(paypalOrderId)
      const updated = await orderService.markPaid(order.id, captureId)
      return res.status(200).json(serializeBigInt({ order: updated }))
    } catch (captureError: any) {
      await orderService.markFailed(order.id)
      return res.status(402).json({ error: captureError?.message || 'Payment declined' })
    }
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code = message === 'Order not found' ? 404 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
