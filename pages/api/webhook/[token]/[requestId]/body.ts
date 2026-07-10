import type { NextApiRequest, NextApiResponse } from 'next'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { enforceRouteAvailability } from '@/utils/apiAvailability'
import { applyPublicWebhookCors } from '@/utils/publicWebhookCors'
import { getInlineBodyBuffer, getStoredWebhookRequest } from '@/utils/webhookInbox'
import { isValidWebhookToken } from '@/utils/webhookToken'

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
}

function getRouteString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }
  return Array.isArray(value) ? value[0] || null : null
}

function extensionForContentType(contentType: string | null): string {
  if (!contentType) return 'bin'
  if (contentType.includes('json')) return 'json'
  if (contentType.startsWith('text/')) return 'txt'
  if (contentType.includes('xml')) return 'xml'
  if (contentType.includes('octet-stream')) return 'bin'
  return 'bin'
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

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD', 'OPTIONS'])
    res.status(405).json({ error: `Method ${req.method} Not Allowed` })
    return
  }

  const token = getRouteString(req.query.token)
  const requestId = getRouteString(req.query.requestId)

  if (!token || !isValidWebhookToken(token) || !requestId) {
    res.status(400).json({ error: 'Invalid token or request id' })
    return
  }

  try {
    const entry = await getStoredWebhookRequest(token, requestId)
    if (!entry) {
      res.status(404).json({ error: 'Request not found' })
      return
    }

    const { record, bodyFilePath } = entry
    const contentType = record.body.contentType || 'application/octet-stream'
    const ext = extensionForContentType(record.body.contentType)
    const filename = `webhook-${token}-${requestId}.${ext}`

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-store')

    if (bodyFilePath) {
      let size: number | null = null
      try {
        const stats = await stat(bodyFilePath)
        size = stats.size
      } catch {
        res.status(404).json({ error: 'Captured body file is no longer available' })
        return
      }
      if (size !== null) {
        res.setHeader('Content-Length', String(size))
      }
      if (req.method === 'HEAD') {
        res.status(200).end()
        return
      }
      const stream = createReadStream(bodyFilePath)
      stream.on('error', (streamError) => {
        console.error('Webhook body stream failed:', streamError)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to read captured body' })
        } else {
          res.end()
        }
      })
      stream.pipe(res)
      return
    }

    const buffer = getInlineBodyBuffer(record.body)

    res.setHeader('Content-Length', String(buffer.length))
    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }
    res.status(200).end(buffer)
  } catch (error) {
    console.error('Webhook body download failed:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to read captured body' })
    }
  }
}
