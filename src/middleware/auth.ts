import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { authenticateRequest } from '@/lib/auth'
import { corsWithWhitelist } from '@/utils/cors'

export async function checkCORS(req: NextApiRequest, res: NextApiResponse) {
  const corsOk = await corsWithWhitelist(req, res);
  return corsOk;
}

export function withAuth(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Handle CORS first
    const corsOk = await checkCORS(req, res);
    if (!corsOk) return;
    
    const user = await authenticateRequest(req)
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Add user to request object
    (req as any).user = user
    
    return handler(req, res)
  }
}