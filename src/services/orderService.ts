import prisma from '@/lib/prisma'
import { CartService } from './cartService'

export interface CreateOrderInput {
  addressId: string
  deliverySlot?: string
  paymentMethod?: string
  deliveryFee?: number
}

function toBigInt(id: string, label = 'id'): bigint {
  try {
    return BigInt(id)
  } catch {
    throw new Error(`Invalid ${label}`)
  }
}

function generateOrderNumber(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `AGD-${stamp}-${rand}`
}

const ORDER_INCLUDE = {
  items: true,
  address: true,
} as const

export class OrderService {
  private cartService = new CartService()

  async createOrder(userIdStr: string, input: CreateOrderInput) {
    const userId = toBigInt(userIdStr, 'user id')
    const addressId = toBigInt(input.addressId, 'address id')

    const address = await prisma.address.findFirst({ where: { id: addressId, userId } })
    if (!address) throw new Error('Address not found')

    const cart = await this.cartService.getCart(userIdStr)
    if (!cart.items.length) throw new Error('Cart is empty')

    const deliveryFee = input.deliveryFee ?? cart.summary.deliveryFee ?? 0
    const subtotal = cart.summary.subtotal
    const tax = cart.summary.tax
    const total = subtotal + tax + deliveryFee

    const order = await prisma.orders.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        addressId,
        status: 'pending_payment',
        subtotal,
        deliveryFee,
        tax,
        total,
        deliverySlot: input.deliverySlot,
        paymentMethod: input.paymentMethod || 'paypal',
        paymentStatus: 'pending',
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            productName: item.product.name,
            productImage: item.product.imageurl,
            price: item.product.price as any,
            quantity: item.quantity,
            total: item.totals.total,
          })),
        },
      },
      include: ORDER_INCLUDE,
    })

    return order
  }

  async listOrders(userIdStr: string) {
    const userId = toBigInt(userIdStr, 'user id')
    return prisma.orders.findMany({
      where: { userId },
      include: ORDER_INCLUDE,
      orderBy: { created_at: 'desc' },
    })
  }

  async getOrder(userIdStr: string, orderIdOrNumber: string) {
    const userId = toBigInt(userIdStr, 'user id')
    const isNumeric = /^\d+$/.test(orderIdOrNumber)
    const order = await prisma.orders.findFirst({
      where: isNumeric
        ? { id: BigInt(orderIdOrNumber), userId }
        : { orderNumber: orderIdOrNumber, userId },
      include: ORDER_INCLUDE,
    })
    if (!order) throw new Error('Order not found')
    return order
  }

  /** Internal lookup used by the payment service — not scoped to a user id. */
  async getOrderById(orderId: bigint) {
    const order = await prisma.orders.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE })
    if (!order) throw new Error('Order not found')
    return order
  }

  async markAwaitingPayment(orderId: bigint, paypalOrderId: string) {
    return prisma.orders.update({
      where: { id: orderId },
      data: { paypalOrderId, paymentStatus: 'pending', updated_at: new Date() },
    })
  }

  async markPaid(orderId: bigint, paypalCaptureId: string) {
    const order = await prisma.orders.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        paymentStatus: 'completed',
        paypalCaptureId,
        updated_at: new Date(),
      },
      include: ORDER_INCLUDE,
    })
    await this.cartService.clearCart(String(order.userId))
    return order
  }

  async markFailed(orderId: bigint) {
    return prisma.orders.update({
      where: { id: orderId },
      data: { status: 'payment_failed', paymentStatus: 'failed', updated_at: new Date() },
      include: ORDER_INCLUDE,
    })
  }
}
