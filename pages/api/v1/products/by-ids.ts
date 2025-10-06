import type { NextApiRequest, NextApiResponse } from 'next'
import { ProductService } from '@/services/productService'
import { serializeBigInt } from '@/utils/serialize'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { categoryId, productId } = req.body

    if (!categoryId || typeof categoryId !== 'number') {
      return res.status(400).json({ error: 'Category ID is required and must be a number' })
    }

    if (!productId || typeof productId !== 'number') {
      return res.status(400).json({ error: 'Product ID is required and must be a number' })
    }

    const productService = new ProductService()
    const product = await productService.getProductByCategoryAndProductId(categoryId, productId)

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.status(200).json(serializeBigInt({ product }))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export default withCORS(handler)
