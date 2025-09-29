import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true })
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

export default withCORS(handler)