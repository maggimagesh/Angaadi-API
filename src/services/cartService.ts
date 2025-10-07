import prisma from '@/lib/prisma'

export interface AddToCartInput {
  productId: number
  quantity?: number
}

export class CartService {
  private toBigInt(id: string): bigint {
    try {
      return BigInt(id)
    } catch {
      throw new Error('Invalid user id')
    }
  }

  async addToCart(userIdStr: string, input: AddToCartInput) {
    const userId = this.toBigInt(userIdStr)
    const { productId, quantity = 1 } = input

    if (!productId || productId <= 0) throw new Error('Invalid productId')
    if (quantity <= 0) throw new Error('Quantity must be >= 1')

    const product = await prisma.productsdata.findUnique({ where: { id: productId } })
    if (!product || product.isactive === false) throw new Error('Product not found')

    const existing = await prisma.cart.findFirst({ where: { userId, productId } })

    if (existing) {
      await prisma.cart.update({
        where: { id: existing.id },
        data: { productCount: (existing.productCount ?? 0) + quantity }
      })
    } else {
      await prisma.cart.create({
        data: {
          userId,
          productId,
          productCount: quantity
        }
      })
    }

    return this.getCart(userIdStr)
  }

  async deleteCartItem(userIdStr: string, productId: number) {
    const userId = this.toBigInt(userIdStr)

    if (!productId || productId <= 0) throw new Error('Invalid productId')

    const existing = await prisma.cart.findFirst({ where: { userId, productId } })
    if (!existing) throw new Error('Cart item not found')

    await prisma.cart.delete({
      where: { id: existing.id }
    })

    return this.getCart(userIdStr)
  }

  async getCart(userIdStr: string) {
    const userId = this.toBigInt(userIdStr)

    const items = await prisma.cart.findMany({
      where: { userId },
      include: {
        productsdata: {
          include: { categories: true }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    const mapped = items.map((i) => {
      const p = i.productsdata!
      const qty = i.productCount ?? 1
      const price = Number(p.price as any)
      const old = p.oldprice ? Number(p.oldprice as any) : price
      const total = price * qty
      const youSave = Math.max(0, old - price) * qty
      return {
        itemId: i.id,
        productId: p.id,
        quantity: qty,
        product: {
          id: p.id,
          name: p.productname,
          brand: p.brand,
          imageurl: p.imageurl,
          freedelivery: !!p.freedelivery,
          price: p.price,
          oldprice: p.oldprice,
          discountpercent: p.discountpercent ?? (old > price ? Math.round(((old - price) / old) * 100) : 0),
          category: p.categories?.categoryname ?? null,
        },
        totals: { total, youSave }
      }
    })

    const subtotal = mapped.reduce((s, i) => s + i.totals.total, 0)
    const savings = mapped.reduce((s, i) => s + i.totals.youSave, 0)
    const allFree = mapped.every((i) => i.product.freedelivery)
    const deliveryFee = allFree ? 0 : Number(process.env.CART_DELIVERY_FEE ?? 0)
    const taxRate = Number(process.env.CART_TAX_PERCENT ?? 0)
    const tax = Math.round((subtotal * taxRate) / 100)
    const grandTotal = subtotal + deliveryFee + tax

    return {
      items: mapped,
      summary: {
        subtotal,
        youSave: savings,
        deliveryFee,
        tax,
        total: grandTotal,
      },
    }
  }
}
