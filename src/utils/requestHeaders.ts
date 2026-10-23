import type { IncomingHttpHeaders } from 'http'

// Builds the "what did my browser send?" report served by
// /api/v1/request-headers. Kept free of Next.js types so it can be unit tested
// with plain objects.

export type HeaderOrigin = 'client' | 'proxy'

export type ReportedHeader = {
  /** Header name with the casing it arrived with (falls back to lowercase). */
  name: string
  value: string
  /** Credentials and session data: the UI masks these until asked to reveal. */
  sensitive: boolean
  /** "proxy" when the header was added by the hosting edge, not the browser. */
  origin: HeaderOrigin
}

export type RequestHeadersReport = {
  ok: true
  method: string
  httpVersion: string
  protocol: string
  host: string | null
  path: string
  ip: string | null
  userAgent: string | null
  headerCount: number
  headers: ReportedHeader[]
  timestamp: string
}

export type RequestLike = {
  method?: string
  url?: string
  httpVersion?: string
  headers: IncomingHttpHeaders
  rawHeaders?: string[]
  socket?: { remoteAddress?: string; encrypted?: boolean }
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
])

// Headers the hosting edge (Vercel, Fly, Cloudflare, nginx…) adds or rewrites
// on the way in. They are still part of the request the API received, so they
// are listed, but flagged so the page can tell them apart from the browser's.
const PROXY_HEADER_NAMES = new Set([
  'forwarded',
  'via',
  'x-real-ip',
  'true-client-ip',
  'fly-client-ip',
  'fly-region',
  'fly-request-id',
  'fly-forwarded-port',
  'fly-forwarded-proto',
  'fly-forwarded-ssl',
  'fly-traceparent',
  'fly-tracestate',
  'x-request-id',
  'x-matched-path',
  'x-invoke-path',
  'x-invoke-query',
  'x-invoke-output',
  'x-middleware-invoke',
])
const PROXY_HEADER_PREFIXES = ['x-forwarded-', 'x-vercel-', 'cf-', 'x-amzn-', 'x-envoy-']

// Headers the hosting platform adds for its own use. They are never echoed:
// some are credentials (x-vercel-oidc-token, x-vercel-proxy-signature), and the
// rest are internal routing noise. Vercel also copies a few response-header
// names onto the request, which the browser never sent.
const HIDDEN_HEADER = /^(x-vercel-|x-middleware-|x-matched-path$|x-invoke-|x-now-|strict-transport-security$|referrer-policy$|x-content-type-options$)/i

// The edge forwards headers in a different order on every request, so rows are
// sorted: browser headers in the order Chrome sends them, then anything else
// alphabetically, then proxy headers alphabetically.
const BROWSER_ORDER = [
  'host', 'connection', 'cache-control', 'pragma', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'upgrade-insecure-requests', 'user-agent', 'accept', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-user',
  'sec-fetch-dest', 'sec-fetch-storage-access', 'referer', 'accept-encoding', 'accept-language', 'cookie',
  'if-none-match', 'if-modified-since', 'priority',
]

export function isHiddenHeader(name: string): boolean {
  return HIDDEN_HEADER.test(name)
}

function headerRank(name: string): number {
  if (isProxyHeader(name)) return 2000
  const i = BROWSER_ORDER.indexOf(name.toLowerCase())
  return i === -1 ? 1000 : i
}

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADERS.has(name.toLowerCase())
}

export function isProxyHeader(name: string): boolean {
  const lower = name.toLowerCase()
  return PROXY_HEADER_NAMES.has(lower) || PROXY_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function firstValue(value: string | string[] | undefined): string | null {
  const single = Array.isArray(value) ? value[0] : value
  const trimmed = single?.trim()
  return trimmed ? trimmed : null
}

function normalizeIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/^::ffff:/i, '')
  return trimmed ? trimmed : null
}

const CLIENT_IP_HEADERS = ['cf-connecting-ip', 'true-client-ip', 'fly-client-ip', 'x-real-ip', 'x-vercel-forwarded-for']

export function resolveClientIp(req: RequestLike): string | null {
  for (const name of CLIENT_IP_HEADERS) {
    const ip = normalizeIp(firstValue(req.headers[name])?.split(',')[0])
    if (ip) return ip
  }
  const forwardedFor = normalizeIp(firstValue(req.headers['x-forwarded-for'])?.split(',')[0])
  if (forwardedFor) return forwardedFor
  return normalizeIp(req.socket?.remoteAddress)
}

function resolveProtocol(req: RequestLike): string {
  const forwarded = firstValue(req.headers['x-forwarded-proto'])?.split(',')[0]?.trim().toLowerCase()
  if (forwarded === 'http' || forwarded === 'https') return forwarded
  return req.socket?.encrypted ? 'https' : 'http'
}

/**
 * Lists headers in a stable order with platform-internal headers removed.
 * rawHeaders keeps the sender's casing and repeats; when it is unavailable the
 * parsed (lowercased) map is used instead, one row per value.
 */
export function listHeaders(req: RequestLike): ReportedHeader[] {
  const pairs: Array<[string, string]> = []

  if (Array.isArray(req.rawHeaders) && req.rawHeaders.length > 0) {
    for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
      pairs.push([req.rawHeaders[i], req.rawHeaders[i + 1]])
    }
  } else {
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) {
        pairs.push([name, item])
      }
    }
  }

  return pairs
    .filter(([name]) => !isHiddenHeader(name))
    .map((pair, index) => ({ pair, index }))
    .sort((a, b) =>
      headerRank(a.pair[0]) - headerRank(b.pair[0]) ||
      a.pair[0].toLowerCase().localeCompare(b.pair[0].toLowerCase()) ||
      a.index - b.index
    )
    .map(({ pair: [name, value] }) => ({
    name,
    value,
    sensitive: isSensitiveHeader(name),
    origin: isProxyHeader(name) ? 'proxy' : 'client',
  }))
}

export function buildRequestHeadersReport(req: RequestLike, now: Date = new Date()): RequestHeadersReport {
  const headers = listHeaders(req)
  return {
    ok: true,
    method: (req.method || 'GET').toUpperCase(),
    httpVersion: req.httpVersion || '1.1',
    protocol: resolveProtocol(req),
    host: firstValue(req.headers.host),
    path: (req.url || '/').split('?')[0] || '/',
    ip: resolveClientIp(req),
    userAgent: firstValue(req.headers['user-agent']),
    headerCount: headers.length,
    headers,
    timestamp: now.toISOString(),
  }
}
