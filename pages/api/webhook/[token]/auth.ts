import type { NextApiRequest, NextApiResponse } from 'next'
import { enforceRouteAvailability } from '@/utils/apiAvailability'
import { applyPublicWebhookCors } from '@/utils/publicWebhookCors'
import {
  clearWebhookAuthConfig,
  getWebhookAuthConfig,
  saveWebhookAuthConfig,
  validateAuthConfigInput,
} from '@/utils/webhookAuth'
import { isValidWebhookToken } from '@/utils/webhookToken'

function getRouteToken(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  return Array.isArray(value) ? value[0] || null : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyPublicWebhookCors(req, res)

  const routeAvailable = await enforceRouteAvailability(req, res)
  if (!routeAvailable) {
    return
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const token = getRouteToken(req.query.token)

  if (!token || !isValidWebhookToken(token)) {
    res.status(400).json({ error: 'Invalid webhook token' })
    return
  }

  try {
    if (req.method === 'GET') {
      const config = await getWebhookAuthConfig(token)
      res.status(200).json({ token, config })
      return
    }

    if (req.method === 'PUT') {
      const validation = validateAuthConfigInput(req.body)
      if ('error' in validation) {
        res.status(400).json({ error: validation.error })
        return
      }

      const config = await saveWebhookAuthConfig(token, validation.config)
      res.status(200).json({ ok: true, token, config })
      return
    }

    if (req.method === 'DELETE') {
      const config = await clearWebhookAuthConfig(token)
      res.status(200).json({ ok: true, token, config })
      return
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE', 'OPTIONS'])
    res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  } catch (error) {
    console.error('Webhook auth config request failed:', error)
    res.status(500).json({ error: 'Failed to process webhook authorization settings' })
  }
}
