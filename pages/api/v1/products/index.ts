import type { NextApiRequest, NextApiResponse } from 'next'
import { ProductService } from '@/services/productService'
import { serializeBigInt } from '@/utils/serialize'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const productService = new ProductService()
    const products = await productService.getAllProducts()

    res.status(200).json(serializeBigInt({ products }))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

