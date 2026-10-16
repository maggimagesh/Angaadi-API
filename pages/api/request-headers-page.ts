import { randomBytes } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { enforceRouteAvailability } from '@/utils/apiAvailability'
import { buildRequestHeadersReport } from '@/utils/requestHeaders'
import { renderRequestHeadersPage } from '@/utils/requestHeadersPage'

// Served at /request-headers (see the rewrite in next.config.js): a complete,
// server-rendered HTML page listing the headers of the page request itself.
// The JSON twin of this page is /api/v1/request-headers.

// The storefront the breadcrumb links back to. Set UI_ORIGIN in Vercel when the domain changes.
const UI_ORIGIN = (process.env.UI_ORIGIN || 'https://angaadi.dev').replace(/\/+$/, '')

const PAGE_PATH = '/request-headers'
const JSON_PATH = '/api/v1/request-headers'

function firstHeader(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim() || undefined
}

// Only a well-formed host is reflected into links; anything else falls back to a relative URL.
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i

export function resolvePageUrl(req: Pick<NextApiRequest, 'headers'>, protocol: string): string {
  const host = firstHeader(req.headers['x-forwarded-host']) || firstHeader(req.headers.host)
  if (!host || !HOST_PATTERN.test(host)) return PAGE_PATH
  return `${protocol}://${host}${PAGE_PATH}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeAvailable = await enforceRouteAvailability(req, res)
  if (!routeAvailable) return

  // Personal to each visitor (IP, cookies, auth), so nothing may cache it.
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const nonce = randomBytes(16).toString('base64')
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; ')
  )
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (req.method === 'HEAD') {
    return res.status(200).end()
  }

  const report = buildRequestHeadersReport(req)
  const html = renderRequestHeadersPage(report, {
    pageUrl: resolvePageUrl(req, report.protocol),
    jsonUrl: JSON_PATH,
    siteUrl: UI_ORIGIN,
    nonce,
  })
  return res.status(200).send(html)
}
