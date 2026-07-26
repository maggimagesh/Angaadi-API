import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'

type HealthResponse = {
  ok: true
  status: 'ok'
  message: string
  service: string
  timestamp: string
  uptime: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse | { error: string }>) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const health: HealthResponse = {
    ok: true,
    status: 'ok',
    message: 'Angaadi API is healthy',
    service: 'angaadi-api',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  }

  if (req.method === 'HEAD') {
    return res.status(200).end()
  }

  return res.status(200).json(health)
}

export default withCORS(handler)
