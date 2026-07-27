import crypto from 'crypto'

/**
 * PayPal Orders v2 (sandbox by default). When PAYPAL_CLIENT_ID / SECRET are
 * not configured, falls back to a "demo" mode that fabricates order and
 * capture ids locally so the checkout flow stays exercisable — e.g. for
 * automated tests — without live sandbox credentials. `demo: true` on the
 * response marks a fabricated id; real credentials call the live sandbox.
 */

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'
const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || 'USD'

function isConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error('Failed to authenticate with PayPal')
  const json = await res.json()
  return json.access_token as string
}

export interface CreatedPaypalOrder {
  paypalOrderId: string
  demo: boolean
}

export interface CapturedPaypalOrder {
  captureId: string
  status: string
}

export class PaypalService {
  isDemoMode(): boolean {
    return !isConfigured()
  }

  async createOrder(amount: number): Promise<CreatedPaypalOrder> {
    if (!isConfigured()) {
      return { paypalOrderId: `DEMO-${crypto.randomUUID()}`, demo: true }
    }

    const token = await getAccessToken()
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: PAYPAL_CURRENCY, value: amount.toFixed(2) } }],
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.message || 'Failed to create PayPal order')
    return { paypalOrderId: json.id, demo: false }
  }

  async captureOrder(paypalOrderId: string): Promise<CapturedPaypalOrder> {
    if (paypalOrderId.startsWith('DEMO-')) {
      return { captureId: `DEMO-CAPTURE-${crypto.randomUUID()}`, status: 'COMPLETED' }
    }

    const token = await getAccessToken()
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.message || 'PayPal capture failed')

    const status = json?.status
    const captureId = json?.purchase_units?.[0]?.payments?.captures?.[0]?.id
    if (status !== 'COMPLETED' || !captureId) {
      throw new Error('Payment was not completed')
    }
    return { captureId, status }
  }
}
