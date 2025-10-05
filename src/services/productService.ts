import prisma from '@/lib/prisma'

export interface Product {
  id: number
  categoryname: string
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
    return await prisma.categories.findMany({
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

    const product = await prisma.categories.findUnique({
      where: { id: productId },
    })
    
    if (!product) {
      throw new Error('Product not found')
    }
    
    return product
  }

  async getProductsByCategoryId(categoryId: number) {
    const products = await prisma.productsdata.findMany({
      where: {
        categoryid: categoryId,
        isactive: true
      },
      orderBy: {
        brand: 'asc'
      }
    })

    return products
  }
}

