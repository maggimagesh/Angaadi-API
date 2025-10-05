import type { NextApiRequest, NextApiResponse } from 'next'
import { ProductService } from '@/services/productService'
import { serializeBigInt } from '@/utils/serialize'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { categoryid } = req.body

    if (!categoryid || typeof categoryid !== 'number') {
      return res.status(400).json({ error: 'Invalid category ID' })
    }

    const productService = new ProductService()
    const products = await productService.getProductsByCategoryId(categoryid)

    res.status(200).json(serializeBigInt({ products }))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export default withCORS(handler)
