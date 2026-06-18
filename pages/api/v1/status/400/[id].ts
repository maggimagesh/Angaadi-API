import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'

/*
 * CRAWLER TEST FIXTURE — GET /api/v1/status/400/:id
 *
 * Always responds 400 Bad Request, regardless of HTTP method or :id value.
 * Backs the 100 links on the /bad-request fixture page
 * (public/bad-request/index.html). The :id segment (1..100) only exists so
 * every link is a distinct URL that a crawler will not collapse via dedup.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const ref = Array.isArray(id) ? id[0] : id

  // Never cache a fixture response — every crawl must hit a fresh 400.
  res.setHeader('Cache-Control', 'no-store')

  // HEAD requests get the status with no body.
  if (req.method === 'HEAD') {
    return res.status(400).end()
  }

  return res.status(400).json({
    error: 'Bad Request',
    statusCode: 400,
    message: `Intentional 400 response for crawler fixture (ref: ${ref ?? 'none'})`,
  })
}

export default withCORS(handler)
