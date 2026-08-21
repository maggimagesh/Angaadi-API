import type { NextApiRequest, NextApiResponse } from 'next'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { createGzip, constants as zlibConstants } from 'zlib'
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

// The inspector pulls huge bodies (100 MB+) a slice at a time so the browser
// never has to hold one open socket for the whole transfer and can show real
// progress. Slices are capped so a single request can't pin an unbounded
// amount of the machine's memory when gzip buffers.
const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024
const MAX_CHUNK_BYTES = 64 * 1024 * 1024

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

function isCompressibleContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const value = contentType.toLowerCase()
  return (
    value.startsWith('text/') ||
    value.includes('json') ||
    value.includes('xml') ||
    value.includes('javascript') ||
    value.includes('x-www-form-urlencoded') ||
    value.includes('ndjson') ||
    value.includes('yaml') ||
    value.includes('csv')
  )
}

function acceptsGzip(req: NextApiRequest): boolean {
  const header = req.headers['accept-encoding']
  const value = Array.isArray(header) ? header.join(',') : header || ''
  return /\bgzip\b/i.test(value)
}

function parsePositiveInt(value: string | string[] | undefined): number | null {
  const raw = getRouteString(value)
  if (raw === null || raw.trim() === '') {
    return null
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return Math.floor(parsed)
}

interface ByteWindow {
  start: number
  end: number // inclusive
}

// Parses a single-range `Range: bytes=a-b` header. Multi-range requests are
// intentionally unsupported (the inspector never sends them) and fall back to
// a full-body response.
function parseRangeHeader(value: string | undefined, sizeBytes: number): ByteWindow | 'unsatisfiable' | null {
  if (!value) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match

  if (rawStart === '' && rawEnd === '') {
    return null
  }

  if (rawStart === '') {
    const suffixLength = Number(rawEnd)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return 'unsatisfiable'
    }
    const start = Math.max(sizeBytes - suffixLength, 0)
    return { start, end: Math.max(sizeBytes - 1, 0) }
  }

  const start = Number(rawStart)
  if (!Number.isFinite(start) || start >= sizeBytes) {
    return 'unsatisfiable'
  }

  const end = rawEnd === '' ? sizeBytes - 1 : Math.min(Number(rawEnd), sizeBytes - 1)
  if (!Number.isFinite(end) || end < start) {
    return 'unsatisfiable'
  }

  return { start, end }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyPublicWebhookCors(req, res)
  res.setHeader(
    'Access-Control-Expose-Headers',
    [
      'Content-Type',
      'Content-Length',
      'Content-Range',
      'Content-Encoding',
      'Accept-Ranges',
      'X-Body-Total-Bytes',
      'X-Body-Offset',
      'X-Body-Chunk-Bytes',
      'X-Body-Complete',
    ].join(', ')
  )

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

    // Resolve the bytes to serve from, plus their true total size.
    let inlineBuffer: Buffer | null = null
    let totalBytes: number

    if (bodyFilePath) {
      try {
        const stats = await stat(bodyFilePath)
        totalBytes = stats.size
      } catch {
        res.status(404).json({ error: 'Captured body file is no longer available' })
        return
      }
    } else {
      inlineBuffer = getInlineBodyBuffer(record.body)
      totalBytes = inlineBuffer.length
    }

    // `?meta=1` lets the inspector size up the payload (and confirm the body is
    // still on disk) before it starts pulling slices.
    if (getRouteString(req.query.meta) === '1') {
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({
        token,
        requestId,
        receivedAt: record.receivedAt,
        contentType: record.body.contentType,
        format: record.body.format,
        sizeBytes: totalBytes,
        truncated: Boolean(record.body.truncated),
        chunkBytes: DEFAULT_CHUNK_BYTES,
      })
      return
    }

    const offsetParam = parsePositiveInt(req.query.offset)
    const limitParam = parsePositiveInt(req.query.limit)
    const rangeResult = parseRangeHeader(req.headers.range, totalBytes)

    let window: ByteWindow | null = null
    let partial = false

    if (offsetParam !== null || limitParam !== null) {
      // Query-parameter slicing: a plain 200 carrying an explicitly described
      // slice. Unlike a 206 this can still be gzipped end to end, which is what
      // makes a 127 MB JSON payload practical to pull across a long-haul link.
      const start = Math.min(offsetParam ?? 0, totalBytes)
      const limit = Math.min(limitParam ?? DEFAULT_CHUNK_BYTES, MAX_CHUNK_BYTES)
      const end = Math.min(start + Math.max(limit, 1), totalBytes) - 1
      window = end < start ? { start, end: start - 1 } : { start, end }
    } else if (rangeResult === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${totalBytes}`)
      res.status(416).json({ error: 'Requested range not satisfiable' })
      return
    } else if (rangeResult) {
      window = rangeResult
      partial = true
    }

    const start = window ? window.start : 0
    const end = window ? window.end : totalBytes - 1
    const sliceBytes = totalBytes === 0 ? 0 : Math.max(end - start + 1, 0)

    res.setHeader('Content-Type', contentType)
    res.setHeader(
      'Content-Disposition',
      `${getRouteString(req.query.download) === '1' ? 'attachment' : 'inline'}; filename="${filename}"`
    )
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('X-Body-Total-Bytes', String(totalBytes))
    res.setHeader('X-Body-Offset', String(start))
    res.setHeader('X-Body-Chunk-Bytes', String(sliceBytes))
    res.setHeader('X-Body-Complete', start + sliceBytes >= totalBytes ? '1' : '0')

    // Range responses stay uncompressed: `Content-Range` describes raw byte
    // offsets, so gzipping one would misdescribe what the client receives.
    // The inspector's own loader uses `?offset=/?limit=` instead and does get
    // compression.
    const compress = !partial && isCompressibleContentType(record.body.contentType) && acceptsGzip(req)

    if (partial) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalBytes}`)
      res.status(206)
    } else {
      res.status(200)
    }

    if (compress) {
      res.setHeader('Content-Encoding', 'gzip')
      res.setHeader('Vary', 'Accept-Encoding')
    } else {
      res.setHeader('Content-Length', String(sliceBytes))
    }

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    if (sliceBytes === 0) {
      res.end()
      return
    }

    const source = bodyFilePath
      ? createReadStream(bodyFilePath, { start, end })
      : Readable.from([(inlineBuffer as Buffer).subarray(start, end + 1)])

    try {
      if (compress) {
        // Level 6 (default) trades a little CPU for ~10x less to ship; the
        // machine is I/O bound, and the wire is the bottleneck here.
        await pipeline(source, createGzip({ level: zlibConstants.Z_DEFAULT_COMPRESSION }), res)
      } else {
        await pipeline(source, res)
      }
    } catch (streamError) {
      // A client that navigates away mid-transfer aborts the socket; that is
      // routine for 100 MB+ payloads and is not worth logging as a failure.
      const code = (streamError as NodeJS.ErrnoException)?.code
      if (code !== 'ERR_STREAM_PREMATURE_CLOSE' && code !== 'EPIPE' && code !== 'ECONNRESET') {
        console.error('Webhook body stream failed:', streamError)
      }
      if (!res.writableEnded) {
        res.destroy()
      }
    }
  } catch (error) {
    console.error('Webhook body download failed:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to read captured body' })
    } else if (!res.writableEnded) {
      res.destroy()
    }
  }
}
