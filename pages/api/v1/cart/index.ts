import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { serializeBigInt } from '@/utils/serialize'
import { CartService } from '@/services/cartService'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user as { sub: string }
  const service = new CartService()

  try {
    if (req.method === 'GET') {
      const cart = await service.getCart(user.sub)
      return res.status(200).json(serializeBigInt(cart))
    }

    if (req.method === 'POST') {
      const { productId, quantity } = req.body || {}
      if (typeof productId !== 'number') {
        return res.status(400).json({ error: 'productId must be a number' })
      }
      if (quantity !== undefined && typeof quantity !== 'number') {
        return res.status(400).json({ error: 'quantity must be a number' })
      }
      const cart = await service.addToCart(user.sub, { productId, quantity })
      return res.status(201).json(serializeBigInt(cart))
    }

    if (req.method === 'DELETE') {
      const { productId } = req.body || {}
      if (typeof productId !== 'number') {
        return res.status(400).json({ error: 'productId must be a number' })
      }
      const cart = await service.deleteCartItem(user.sub, productId)
      return res.status(200).json(serializeBigInt(cart))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code = message === 'Product not found' || message === 'Invalid user id' || message === 'Cart item not found' ? 400 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
