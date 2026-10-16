import type { NextApiRequest, NextApiResponse } from 'next'
import { enforceRouteAvailability } from '@/utils/apiAvailability'
import { buildRequestHeadersReport } from '@/utils/requestHeaders'
import { renderRequestHeadersPage } from '@/utils/requestHeadersPage'

// Served at /request-headers (see the rewrite in next.config.js): one plain
// HTML table of the headers of the page request itself, with no script.
// The JSON twin of this page is /api/v1/request-headers.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeAvailable = await enforceRouteAvailability(req, res)
  if (!routeAvailable) return

  // Personal to each visitor (IP, cookies, auth), so nothing may cache it.
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // No script may run on this page; only its own inline <style> is allowed.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  )

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (req.method === 'HEAD') {
    return res.status(200).end()
  }

  return res.status(200).send(renderRequestHeadersPage(buildRequestHeadersReport(req)))
}
