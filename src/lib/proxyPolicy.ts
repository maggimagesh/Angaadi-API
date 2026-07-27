import type { NextApiRequest } from 'next'

/**
 * Security policy for the secure proxy: route allowlist, replay guard and
 * per-IP rate limiting. Only routes listed here can be reached through the
 * proxy — everything else (including /system/*, /secure/*, webhooks and any
 * absolute URL) is rejected before an internal request is made.
 */

interface AllowedRoute {
  pattern: RegExp
  methods: ReadonlySet<string>
}

const route = (pattern: RegExp, methods: string[]): AllowedRoute => ({
  pattern,
  methods: new Set(methods),
})

const ID = '[A-Za-z0-9._-]{1,64}'

export const ALLOWED_ROUTES: AllowedRoute[] = [
  route(/^\/products$/, ['GET']),
  route(/^\/products\/by-category$/, ['POST']),
  route(/^\/products\/by-ids$/, ['POST']),
  route(/^\/products\/stock$/, ['POST', 'PATCH']),
  route(new RegExp(`^/products/\\d{1,12}$`), ['GET']),
  route(/^\/cart$/, ['GET', 'POST', 'PUT', 'DELETE']),
  route(/^\/gender$/, ['GET', 'POST']),
  route(/^\/age-group$/, ['GET', 'POST', 'PUT']),
  route(new RegExp(`^/age-group/${ID}$`), ['GET', 'PUT', 'PATCH', 'DELETE']),
  route(/^\/preferred-department$/, ['GET', 'POST']),
  route(new RegExp(`^/preferred-department/${ID}$`), ['GET', 'PUT', 'DELETE']),
  route(/^\/shoe-size$/, ['GET', 'POST', 'PUT']),
  route(new RegExp(`^/shoe-size/${ID}$`), ['GET', 'PUT', 'DELETE']),
  route(/^\/fit-attributes$/, ['GET', 'POST', 'PUT']),
  route(new RegExp(`^/fit-attributes/${ID}$`), ['GET', 'PUT', 'PATCH', 'DELETE']),
  route(/^\/users$/, ['GET']),
  route(/^\/users\/createUser$/, ['POST']),
  route(/^\/users\/signIn$/, ['POST']),
  route(/^\/users\/signOut$/, ['POST']),
  route(/^\/users\/oauth-signin$/, ['POST']),
  route(/^\/users\/forgot-password$/, ['POST']),
  route(/^\/users\/verify-otp$/, ['POST']),
  route(/^\/users\/reset-password$/, ['POST']),
  route(/^\/users\/physical-stats$/, ['GET', 'POST', 'PUT', 'DELETE']),
  route(new RegExp(`^/users/${ID}$`), ['GET']),
  route(/^\/addresses$/, ['GET', 'POST']),
  route(new RegExp(`^/addresses/${ID}$`), ['GET', 'PUT', 'PATCH', 'DELETE']),
  route(/^\/orders$/, ['GET', 'POST']),
  route(new RegExp(`^/orders/${ID}$`), ['GET']),
  route(/^\/payments\/paypal\/create-order$/, ['POST']),
  route(/^\/payments\/paypal\/capture-order$/, ['POST']),
  route(/^\/payments\/paypal\/cancel$/, ['POST']),
]

const SAFE_QUERY = /^[A-Za-z0-9._~%=&+-]*$/
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

export interface ValidatedTarget {
  path: string // pathname + optional query, relative to /api/v1
}

/**
 * Validate a proxied request target. Returns the normalized relative path or
 * an error string. Rejects absolute URLs, traversal, encoded slashes and any
 * route/method combination not present in the allowlist.
 */
export function validateTarget(path: unknown, method: unknown): { ok: true; target: ValidatedTarget; method: string } | { ok: false; error: string } {
  if (typeof method !== 'string' || !ALLOWED_METHODS.has(method.toUpperCase())) {
    return { ok: false, error: 'Method not allowed' }
  }
  const m = method.toUpperCase()

  if (typeof path !== 'string' || path.length === 0 || path.length > 512) {
    return { ok: false, error: 'Invalid path' }
  }
  // Must be a relative /api/v1 sub-path: no scheme, no protocol-relative,
  // no backslashes, no traversal, no encoded control chars.
  if (!path.startsWith('/') || path.startsWith('//')) {
    return { ok: false, error: 'Invalid path' }
  }
  if (/[\\\s]|%2f|%5c|%2e%2e|\.\./i.test(path)) {
    return { ok: false, error: 'Invalid path' }
  }

  const qIndex = path.indexOf('?')
  const pathname = qIndex === -1 ? path : path.slice(0, qIndex)
  const query = qIndex === -1 ? '' : path.slice(qIndex + 1)

  if (query && !SAFE_QUERY.test(query)) {
    return { ok: false, error: 'Invalid query string' }
  }

  const matched = ALLOWED_ROUTES.find((r) => r.pattern.test(pathname))
  if (!matched) {
    return { ok: false, error: 'Route not allowed through secure proxy' }
  }
  if (!matched.methods.has(m)) {
    return { ok: false, error: 'Method not allowed for this route' }
  }

  return { ok: true, target: { path: query ? `${pathname}?${query}` : pathname }, method: m }
}

// ---------------------------------------------------------------------------
// Replay guard: nonce cache within the accepted timestamp window.
// Best-effort per instance (in-memory); the timestamp window bounds exposure.
// ---------------------------------------------------------------------------

export const TIMESTAMP_SKEW_MS = 120 * 1000

const seenNonces = new Map<string, number>()
const MAX_NONCES = 50_000

export function checkAndStoreNonce(nonce: unknown, ts: unknown): { ok: boolean; error?: string } {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) {
    return { ok: false, error: 'Missing timestamp' }
  }
  const now = Date.now()
  if (Math.abs(now - ts) > TIMESTAMP_SKEW_MS) {
    return { ok: false, error: 'Request expired' }
  }
  if (typeof nonce !== 'string' || nonce.length < 16 || nonce.length > 64 || !/^[A-Za-z0-9_-]+$/.test(nonce)) {
    return { ok: false, error: 'Missing nonce' }
  }
  if (seenNonces.has(nonce)) {
    return { ok: false, error: 'Replay detected' }
  }
  if (seenNonces.size >= MAX_NONCES) {
    pruneNonces(now)
  }
  seenNonces.set(nonce, now + 2 * TIMESTAMP_SKEW_MS)
  return { ok: true }
}

function pruneNonces(now: number) {
  for (const [nonce, expiry] of seenNonces) {
    if (expiry <= now) seenNonces.delete(nonce)
  }
  // Still full of live entries: drop oldest to keep memory bounded.
  if (seenNonces.size >= MAX_NONCES) {
    const drop = seenNonces.size - MAX_NONCES + 1
    let i = 0
    for (const nonce of seenNonces.keys()) {
      if (i++ >= drop) break
      seenNonces.delete(nonce)
    }
  }
}

// ---------------------------------------------------------------------------
// Rate limiting: simple per-IP sliding window (best-effort per instance).
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60 * 1000
const MAX_BUCKETS = 20_000

export function rateLimit(req: NextApiRequest, scope: string, limitPerMinute: number): boolean {
  const forwarded = req.headers['x-forwarded-for']
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown'
  const key = `${scope}:${ip}`
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear()
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }
  bucket.count += 1
  return bucket.count <= limitPerMinute
}
