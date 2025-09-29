import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // In a real implementation, you might want to blacklist the token
  // For now, just return a success message
  res.status(200).json({ message: 'Signed out successfully' })
}

export default withCORS(handler)