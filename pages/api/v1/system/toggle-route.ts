import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'
import {
  listDisabledRoutes,
  toggleRouteAvailability,
} from '@/utils/apiAvailability'
import type { RouteToggleScope } from '@/utils/apiAvailability'

function isValidScope(scope: unknown): scope is RouteToggleScope {
  return scope === 'exact' || scope === 'prefix'
}

function isAuthorized(req: NextApiRequest): boolean {
  const expectedSecret = process.env.API_TOGGLE_SECRET

  if (!expectedSecret) {
    return true
  }

  const providedSecretHeader = req.headers['x-api-toggle-secret']
  const providedSecret = Array.isArray(providedSecretHeader)
    ? providedSecretHeader[0]
    : providedSecretHeader

  return providedSecret === expectedSecret
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    const disabledRoutes = await listDisabledRoutes()
    return res.status(200).json(disabledRoutes)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { route, scope = 'exact' } = req.body ?? {}

  if (typeof route !== 'string' || !route.trim()) {
    return res.status(400).json({ error: 'A route value is required' })
  }

  if (!isValidScope(scope)) {
    return res.status(400).json({ error: 'Scope must be either exact or prefix' })
  }

  try {
    const result = await toggleRouteAvailability(route, scope)

    return res.status(200).json({
      route: result.route,
      scope: result.scope,
      disabled: result.disabled,
      status: result.disabled ? 'down' : 'up',
    })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}

export default withCORS(handler)
