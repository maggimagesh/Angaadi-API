import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { authenticateRequest } from '@/lib/auth'

export function withAuth(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await authenticateRequest(req)
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Add user to request object
    (req as any).user = user
    
    return handler(req, res)
  }
}