import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { OrderService } from '@/services/orderService'
import { RazorpayService } from '@/services/razorpayService'

/**
 * Confirms a payment the Razorpay checkout handler reported as successful.
 * The client is not trusted: the signature is recomputed server-side from the
 * key secret before the order is marked paid.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = (req as any).user as { sub: string }
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {}
  if (
    (typeof orderId !== 'string' && typeof orderId !== 'number') ||
    typeof razorpayOrderId !== 'string' ||
    typeof razorpayPaymentId !== 'string'
  ) {
    return res
      .status(400)
      .json({ error: 'orderId, razorpayOrderId and razorpayPaymentId are required' })
  }

  const orderService = new OrderService()
  const razorpayService = new RazorpayService()

  try {
    const order = await orderService.getOrder(user.sub, String(orderId))
    if (order.gatewayOrderId !== razorpayOrderId) {
      return res.status(409).json({ error: 'Payment session does not match this order' })
    }
    if (order.status === 'paid') {
      return res.status(200).json(serializeBigInt({ order }))
    }

    try {
      const { paymentId } = razorpayService.verifyPayment(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      )
      const updated = await orderService.markPaid(order.id, paymentId)
      return res.status(200).json(serializeBigInt({ order: updated }))
    } catch (verifyError: any) {
      await orderService.markFailed(order.id)
      return res.status(402).json({ error: verifyError?.message || 'Payment could not be verified' })
    }
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code = message === 'Order not found' ? 404 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
