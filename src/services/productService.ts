import prisma from '@/lib/prisma'

export interface Product {
  id: number
  productname: string
  description: string
  slug: string | null
  badge: string | null
  imageurl: string | null
  displayorder: number | null
  isactive: boolean | null
  icon: string | null
  productcount: number | null
  created_at: Date | null
  updated_at: Date | null
}

export class ProductService {
  async getAllProducts(): Promise<Product[]> {
    return await prisma.products.findMany({
      where: {
        isactive: true
      },
      orderBy: [
        {
          displayorder: 'asc'
        },
        {
          created_at: 'desc'
        }
      ]
    })
  }

  async getProductById(productIdParam: string): Promise<Product> {
    let productId: number
    try {
      productId = parseInt(productIdParam)
      if (isNaN(productId)) {
        throw new Error('Invalid product ID')
      }
    } catch (_e) {
      throw new Error('Invalid product ID')
    }

    const product = await prisma.products.findUnique({
      where: { id: productId },
    })
    
    if (!product) {
      throw new Error('Product not found')
    }
    
    return product
  }
}

