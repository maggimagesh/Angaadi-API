import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/middleware/auth'
import { ProductService } from '@/services/productService'
import { serializeBigInt } from '@/utils/serialize'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed. Use POST or PATCH.' })
  }

  const { productId, quantityChange } = req.body || {}

  if (!productId) {
    return res.status(400).json({ error: 'productId is required' })
  }

  if (quantityChange === undefined || typeof quantityChange !== 'number') {
    return res.status(400).json({ error: 'quantityChange must be a number' })
  }

  const service = new ProductService()

  try {
    const updatedProduct = await service.updateStock(String(productId), quantityChange)
    const serialized = serializeBigInt(updatedProduct)

    // Broadcast stock change to all connected WebSocket clients
    const broadcast = (global as any).__wsBroadcast
    if (typeof broadcast === 'function') {
      broadcast({
        type: req.method === 'POST' ? 'STOCK_ADDED' : 'STOCK_REDUCED',
        product: serialized,
      })
    }

    return res.status(200).json({
      message: 'Stock updated successfully',
      product: serialized
    })
  } catch (error: any) {
    const message = error?.message || 'Internal server error'
    const code = (message === 'Product not found' || message === 'Invalid product ID' || message === 'Stock cannot be reduced below 0') ? 400 : 500
    return res.status(code).json({ error: message })
  }
}

export default withAuth(handler)
