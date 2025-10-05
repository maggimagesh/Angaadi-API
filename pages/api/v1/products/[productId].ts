import type { NextApiRequest, NextApiResponse } from 'next'
import { ProductService } from '@/services/productService'
import { serializeBigInt } from '@/utils/serialize'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { productId } = req.query

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ error: 'Invalid product ID' })
    }

    const productService = new ProductService()
    const product = await productService.getProductById(productId)

    res.status(200).json(serializeBigInt({ product }))
  } catch (error: any) {
    if (error.message === 'Product not found' || error.message === 'Invalid product ID') {
      return res.status(404).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
}

export default withCORS(handler)
