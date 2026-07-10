import type { NextApiRequest, NextApiResponse } from 'next'
import { stat } from 'fs/promises'
import { enforceRouteAvailability } from '@/utils/apiAvailability'
import { applyPublicWebhookCors } from '@/utils/publicWebhookCors'
import { listStoredWebhookBodySources, type StoredWebhookBodySource } from '@/utils/webhookInbox'
import { isValidWebhookToken } from '@/utils/webhookToken'
import { planZipStream, streamZip, type ZipStreamEntry } from '@/utils/zipStream'

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
}

function getRouteToken(value: string | string[] | undefined): string | null {
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

function safeFilenameSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item'
}

function buildEntryName(source: StoredWebhookBodySource, index: number): string {
  const stamp = source.receivedAt.replace(/[:.]/g, '-')
  const ext = extensionForContentType(source.contentType)
  return `${String(index + 1).padStart(3, '0')}-${safeFilenameSegment(stamp)}-${safeFilenameSegment(source.method)}-${source.id.slice(0, 8)}.${ext}`
}

async function buildZipEntries(sources: StoredWebhookBodySource[]): Promise<ZipStreamEntry[]> {
  const entries: ZipStreamEntry[] = []

  for (const [index, source] of sources.entries()) {
    const name = buildEntryName(source, index)
    const modifiedAt = new Date(source.receivedAt)

    if (source.bodyFilePath) {
      let sizeBytes: number
      try {
        const stats = await stat(source.bodyFilePath)
        sizeBytes = stats.size
      } catch {
        // Body file already evicted from disk — skip this request.
        continue
      }
      entries.push({
        name,
        sizeBytes,
        modifiedAt,
        source: { kind: 'file', path: source.bodyFilePath },
      })
      continue
    }

    const data = source.inlineBody ?? Buffer.alloc(0)
    entries.push({
      name,
      sizeBytes: data.length,
      modifiedAt,
      source: { kind: 'buffer', data },
    })
  }

  return entries
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

  const token = getRouteToken(req.query.token)

  if (!token || !isValidWebhookToken(token)) {
    res.status(400).json({ error: 'Invalid webhook token' })
    return
  }

  try {
    const sources = listStoredWebhookBodySources(token)
    const entries = await buildZipEntries(sources)

    if (entries.length === 0) {
      res.status(404).json({ error: 'No captured request bodies to download' })
      return
    }

    const plan = planZipStream(entries)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="webhook-${token}-${stamp}.zip"`)
    res.setHeader('Content-Length', String(plan.totalSizeBytes))
    res.setHeader('Cache-Control', 'no-store')

    if (req.method === 'HEAD') {
      res.status(200).end()
      return
    }

    res.status(200)
    await streamZip(plan, res)
    res.end()
  } catch (error) {
    console.error('Webhook zip download failed:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to build zip download' })
    } else {
      // Headers (incl. Content-Length) already sent — cut the connection so the
      // client sees a failed download instead of a silently corrupt archive.
      res.destroy()
    }
  }
}
