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
  const { orderId } = req.body || {}
  if (typeof orderId !== 'string' && typeof orderId !== 'number') {
    return res.status(400).json({ error: 'orderId is required' })
  }

  const orderService = new OrderService()
  const paypalService = new PaypalService()

  try {
    const order = await orderService.getOrder(user.sub, String(orderId))
    if (order.status !== 'pending_payment') {
      return res.status(409).json({ error: `Order is ${order.status}, not awaiting payment` })
    }

    const { paypalOrderId, demo } = await paypalService.createOrder(Number(order.total))
    await orderService.markAwaitingPayment(order.id, paypalOrderId)

    return res.status(200).json(serializeBigInt({ paypalOrderId, demo, orderNumber: order.orderNumber }))
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code = message === 'Order not found' ? 404 : message.includes('awaiting payment') ? 409 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
