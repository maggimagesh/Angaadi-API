import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'
import { buildRequestHeadersReport, type RequestHeadersReport } from '@/utils/requestHeaders'

// Echoes back the HTTP request headers the caller sent, the way
// manytools.org/http-html-text/http-request-headers does. Opened directly in a
// browser tab it shows the navigation headers; called with fetch() it shows the
// headers of that fetch (Origin, Sec-Fetch-Mode: cors, …).
async function handler(req: NextApiRequest, res: NextApiResponse<RequestHeadersReport | { error: string }>) {
  // The body is personal to each caller (cookies, IP, auth), so nothing may cache it.
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'HEAD') {
    return res.status(200).end()
  }

  return res.status(200).json(buildRequestHeadersReport(req))
}

export default withCORS(handler)
