import crypto from 'crypto'

/**
 * Razorpay Orders API (test mode by default). When RAZORPAY_KEY_ID /
 * RAZORPAY_KEY_SECRET are not configured, falls back to a "demo" mode that
 * fabricates order and payment ids locally so the checkout flow stays
 * exercisable — e.g. for automated tests — without live test credentials.
 * `demo: true` on the response marks a fabricated id; real credentials call
 * the live test API.
 *
 * Unlike PayPal, Razorpay is INR-native and settles the amount in paise, so
 * the rupee totals stored on `orders` map across without conversion.
 */

const RAZORPAY_API_BASE = process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com'
const RAZORPAY_CURRENCY = process.env.RAZORPAY_CURRENCY || 'INR'

function isConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

function authHeader(): string {
  const pair = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  return `Basic ${Buffer.from(pair).toString('base64')}`
}

/** Razorpay rejects fractional paise, so round rather than truncate. */
function toPaise(amountInRupees: number): number {
  return Math.round(amountInRupees * 100)
}

export interface CreatedRazorpayOrder {
  razorpayOrderId: string
  amount: number
  currency: string
  keyId: string | null
  demo: boolean
}

export interface VerifiedRazorpayPayment {
  paymentId: string
  status: string
}

export class RazorpayService {
  isDemoMode(): boolean {
    return !isConfigured()
  }

  /**
   * `forceDemo` lets the client fall back to demo mode when the Razorpay
   * checkout script cannot load — a real test order id can never be verified
   * without a buyer-completed payment, so the fallback needs a fabricated one.
   */
  async createOrder(amountInRupees: number, receipt: string, forceDemo = false): Promise<CreatedRazorpayOrder> {
    const amount = toPaise(amountInRupees)

    if (forceDemo || !isConfigured()) {
      return {
        razorpayOrderId: `DEMO-${crypto.randomUUID()}`,
        amount,
        currency: RAZORPAY_CURRENCY,
        keyId: null,
        demo: true,
      }
    }

    const res = await fetch(`${RAZORPAY_API_BASE}/v1/orders`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: RAZORPAY_CURRENCY,
        // Razorpay caps receipt at 40 chars.
        receipt: receipt.slice(0, 40),
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json?.error?.description || 'Failed to create Razorpay order')
    }

    return {
      razorpayOrderId: json.id,
      amount: json.amount,
      currency: json.currency,
      keyId: process.env.RAZORPAY_KEY_ID as string,
      demo: false,
    }
  }

  /**
   * Confirms the payment really came from Razorpay. The checkout handler
   * returns `razorpay_signature` = HMAC-SHA256(order_id|payment_id) keyed on
   * the secret — recomputing it server-side is what makes a client-reported
   * success trustworthy.
   */
  verifyPayment(orderId: string, paymentId: string, signature: string): VerifiedRazorpayPayment {
    if (orderId.startsWith('DEMO-')) {
      return { paymentId: `DEMO-PAY-${crypto.randomUUID()}`, status: 'captured' }
    }

    if (!isConfigured()) {
      throw new Error('Razorpay is not configured')
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')

    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(signature || '', 'utf8')
    // timingSafeEqual throws on length mismatch, so guard before comparing.
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error('Payment signature verification failed')
    }

    return { paymentId, status: 'captured' }
  }
}
