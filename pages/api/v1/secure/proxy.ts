import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'
import { decryptEnvelope, encryptEnvelope, unwrapSessionToken } from '@/lib/secureProxy'
import { checkAndStoreNonce, rateLimit, validateTarget } from '@/lib/proxyPolicy'

/**
 * POST /api/v1/secure/proxy
 *
 * Encrypted request tunnel. The client sends an AES-256-GCM encrypted
 * envelope describing the real request (path, method, headers, body). The
 * proxy validates it against the route allowlist, executes the request
 * against the internal API, and returns the response encrypted under the
 * same session key. DevTools therefore only ever sees ciphertext.
 *
 * The HTTP status of this endpoint is always 200 for successfully tunneled
 * requests — the real status code travels inside the encrypted envelope.
 */

const MAX_BODY_BYTES = 256 * 1024
const FORWARDED_HEADERS = new Set(['authorization', 'content-type'])

interface InnerRequest {
  p?: unknown // path relative to /api/v1
  m?: unknown // method
  h?: unknown // headers subset
  b?: unknown // body (JSON-serializable) or null
  ts?: unknown // client timestamp (ms)
  n?: unknown // random nonce
}

function internalOrigin(req: NextApiRequest): string {
  if (process.env.INTERNAL_API_ORIGIN) return process.env.INTERNAL_API_ORIGIN
  const host = req.headers.host || `127.0.0.1:${process.env.PORT || 3300}`
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
  return `${proto.split(',')[0]}://${host}`
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!rateLimit(req, 'proxy', 240)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const { t, iv, d } = req.body ?? {}
  if (typeof t !== 'string' || typeof iv !== 'string' || typeof d !== 'string') {
    return res.status(400).json({ error: 'Malformed request' })
  }

  const session = unwrapSessionToken(t)
  if (!session) {
    // 401 signals the client to re-handshake.
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  const inner = decryptEnvelope(session.key, iv, d) as InnerRequest | null
  if (!inner || typeof inner !== 'object') {
    return res.status(400).json({ error: 'Decryption failed' })
  }

  const freshness = checkAndStoreNonce(inner.n, inner.ts)
  if (!freshness.ok) {
    return res.status(400).json({ error: freshness.error })
  }

  const validated = validateTarget(inner.p, inner.m)
  if (!validated.ok) {
    return res.status(403).json({ error: validated.error })
  }

  // Forward only an explicit subset of headers supplied by the client.
  const headers: Record<string, string> = { accept: 'application/json' }
  if (inner.h && typeof inner.h === 'object' && !Array.isArray(inner.h)) {
    for (const [name, value] of Object.entries(inner.h as Record<string, unknown>)) {
      const lower = name.toLowerCase()
      if (FORWARDED_HEADERS.has(lower) && typeof value === 'string' && value.length <= 4096 && !/[\r\n]/.test(value)) {
        headers[lower] = value
      }
    }
  }

  let bodyString: string | undefined
  if (inner.b !== undefined && inner.b !== null && validated.method !== 'GET') {
    bodyString = JSON.stringify(inner.b)
    if (Buffer.byteLength(bodyString) > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Request body too large' })
    }
    headers['content-type'] = headers['content-type'] || 'application/json'
  }

  const url = `${internalOrigin(req)}/api/v1${validated.target.path}`

  let upstreamStatus: number
  let upstreamBody: unknown
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)
    const upstream = await fetch(url, {
      method: validated.method,
      headers,
      body: bodyString,
      redirect: 'error',
      signal: controller.signal,
    })
    clearTimeout(timer)
    upstreamStatus = upstream.status
    const text = await upstream.text()
    try {
      upstreamBody = text ? JSON.parse(text) : null
    } catch {
      upstreamBody = { error: 'Upstream returned a non-JSON response' }
    }
  } catch {
    return res.status(200).json(
      encryptEnvelope(session.key, { s: 502, b: { error: 'Upstream request failed' } })
    )
  }

  return res.status(200).json(encryptEnvelope(session.key, { s: upstreamStatus, b: upstreamBody }))
}

export default withCORS(handler)
