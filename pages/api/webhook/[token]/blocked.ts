import type { NextApiRequest, NextApiResponse } from 'next'
import { enforceRouteAvailability } from '@/utils/apiAvailability'
import { applyPublicWebhookCors } from '@/utils/publicWebhookCors'
import { clearBlockedAttempts, listBlockedAttempts } from '@/utils/webhookAuth'
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
      res.status(200).json({ token, blocked: listBlockedAttempts(token) })
      return
    }

    if (req.method === 'DELETE') {
      const deleted = clearBlockedAttempts(token)
      res.status(200).json({ ok: true, token, deleted })
      return
    }

    res.setHeader('Allow', ['GET', 'DELETE', 'OPTIONS'])
    res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  } catch (error) {
    console.error('Webhook blocked-attempts request failed:', error)
    res.status(500).json({ error: 'Failed to process blocked webhook attempts' })
  }
}
