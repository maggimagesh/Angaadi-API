import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { corsWithWhitelist } from '@/utils/cors';
import { enforceRouteAvailability } from '@/utils/apiAvailability'

export function withCORS(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Handle CORS
    const corsOk = await corsWithWhitelist(req, res);
    if (!corsOk) return;

    const routeAvailable = await enforceRouteAvailability(req, res)
    if (!routeAvailable) return;
    
    // Call the original handler
    return handler(req, res);
  };
}
