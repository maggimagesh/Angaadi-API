import type { NextApiRequest, NextApiResponse } from 'next'
import { enforceRouteAvailability } from '@/utils/apiAvailability'
import { applyPublicWebhookCors } from '@/utils/publicWebhookCors'
import { checkWebhookAuth, getWebhookAuthConfig, recordBlockedAttempt } from '@/utils/webhookAuth'
import { captureWebhookRequest } from '@/utils/webhookInbox'
import { isValidWebhookToken } from '@/utils/webhookToken'

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
    responseLimit: false,
  },
}

function getRouteToken(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  return Array.isArray(value) ? value[0] || null : null
}

function getRoutePath(value: string | string[] | undefined): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  return Array.isArray(value) ? value : []
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

  const authConfig = await getWebhookAuthConfig(token)
  const authResult = checkWebhookAuth(req, authConfig)

  if (!authResult.ok) {
    recordBlockedAttempt(req, token, getRoutePath(req.query.path), authResult)
    res.status(401).json({
      error: 'Unauthorized: this webhook requires authorization headers that were missing or invalid',
    })
    return
  }

  try {
    const { responsePayload } = await captureWebhookRequest(req, token, getRoutePath(req.query.path))

    res.setHeader('Content-Type', 'application/json; charset=utf-8')

    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }

    res.status(200).json(responsePayload)
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode === 413 ? 413 : 500
    if (status === 413) {
      res.status(413).json({ error: 'Webhook body exceeds maximum allowed size' })
      return
    }
    console.error('Webhook capture failed:', error)
    res.status(500).json({ error: 'Failed to capture webhook request' })
  }
}
