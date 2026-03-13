import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'
import type { IncomingHttpHeaders } from 'http'
import type { ParsedUrlQuery } from 'querystring'
import type { NextApiRequest } from 'next'
import type { WebhookCaptureListResponse, WebhookCaptureRecord, WebhookResponseInfo, WebhookStoredBody } from '@/types/webhook'
import { isValidWebhookToken } from '@/utils/webhookToken'

const WEBHOOK_DATA_DIR = path.join(process.cwd(), 'data', 'webhook_inbox')
const JSON_RESPONSE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
}

function getTokenDirectory(token: string): string {
  return path.join(WEBHOOK_DATA_DIR, token)
}

function assertWebhookToken(token: string): string {
  if (!isValidWebhookToken(token)) {
    throw new Error('Invalid webhook token')
  }

  return token
}

function getSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'undefined') {
    return null
  }

  return Array.isArray(value) ? value.join(', ') : value
}

function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  return Object.entries(headers).reduce<Record<string, string | string[]>>((result, [key, value]) => {
    if (typeof value !== 'undefined') {
      result[key] = value
    }

    return result
  }, {})
}

function normalizeQuery(query: ParsedUrlQuery): Record<string, string | string[]> {
  return Object.entries(query).reduce<Record<string, string | string[]>>((result, [key, value]) => {
    if (typeof value === 'undefined') {
      return result
    }

    result[key] = Array.isArray(value) ? value.map(String) : String(value)
    return result
  }, {})
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {}
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, segment) => {
    const [rawKey, ...rawValue] = segment.trim().split('=')

    if (!rawKey) {
      return cookies
    }

    cookies[rawKey] = decodeURIComponent(rawValue.join('=') || '')
    return cookies
  }, {})
}

function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType && (contentType.includes('application/json') || contentType.endsWith('+json')))
}

function isTextualContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false
  }

  return (
    contentType.startsWith('text/') ||
    contentType.includes('application/json') ||
    contentType.endsWith('+json') ||
    contentType.includes('application/xml') ||
    contentType.includes('text/xml') ||
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('application/javascript') ||
    contentType.includes('application/graphql')
  )
}

function looksMostlyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024))
  const decoded = sample.toString('utf8')

  if (decoded.includes('\uFFFD')) {
    return false
  }

  let suspiciousCharacters = 0

  for (let index = 0; index < decoded.length; index += 1) {
    const codePoint = decoded.charCodeAt(index)

    if (codePoint === 9 || codePoint === 10 || codePoint === 13) {
      continue
    }

    if (codePoint >= 32) {
      continue
    }

    suspiciousCharacters += 1
  }

  return decoded.length === 0 || suspiciousCharacters / decoded.length < 0.05
}

function buildBodyPreview(body: WebhookStoredBody): string | null {
  if (body.format === 'binary') {
    return `[binary payload, ${body.sizeBytes} bytes]`
  }

  if (body.format === 'json') {
    return JSON.stringify(body.json, null, 2).slice(0, 2000)
  }

  return body.text ? body.text.slice(0, 2000) : null
}

function buildStoredBody(buffer: Buffer, contentTypeHeader: string | null): WebhookStoredBody {
  const contentType = contentTypeHeader?.split(';')[0]?.trim().toLowerCase() || null

  if (buffer.length === 0) {
    return {
      format: 'empty',
      encoding: 'none',
      sizeBytes: 0,
      contentType,
      text: null,
      json: null,
      base64: null,
      preview: null,
    }
  }

  if (isTextualContentType(contentType) || (!contentType && looksMostlyText(buffer))) {
    const text = buffer.toString('utf8')
    let parsedJson: unknown | null = null
    let format: WebhookStoredBody['format'] = 'text'

    if (isJsonContentType(contentType)) {
      try {
        parsedJson = JSON.parse(text)
        format = 'json'
      } catch {
        format = 'text'
      }
    }

    const storedBody: WebhookStoredBody = {
      format,
      encoding: 'utf8',
      sizeBytes: buffer.length,
      contentType,
      text,
      json: parsedJson,
      base64: null,
      preview: null,
    }

    storedBody.preview = buildBodyPreview(storedBody)
    return storedBody
  }

  const storedBody: WebhookStoredBody = {
    format: 'binary',
    encoding: 'base64',
    sizeBytes: buffer.length,
    contentType,
    text: null,
    json: null,
    base64: buffer.toString('base64'),
    preview: null,
  }

  storedBody.preview = buildBodyPreview(storedBody)
  return storedBody
}

function getRequestOrigin(req: NextApiRequest): string {
  const forwardedProto = getSingleHeaderValue(req.headers['x-forwarded-proto'])?.split(',')[0]?.trim()
  const forwardedHost = getSingleHeaderValue(req.headers['x-forwarded-host'])?.split(',')[0]?.trim()
  const host = forwardedHost || req.headers.host || 'localhost:3000'
  const protocol = forwardedProto || ((req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http')

  return `${protocol}://${host}`
}

function getClientIpAddress(req: NextApiRequest): string | null {
  const forwardedFor = getSingleHeaderValue(req.headers['x-forwarded-for'])

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }

  return req.socket.remoteAddress || null
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

async function persistWebhookRecord(token: string, record: WebhookCaptureRecord): Promise<void> {
  const tokenDirectory = getTokenDirectory(token)
  await fs.mkdir(tokenDirectory, { recursive: true })

  const filename = `${Date.now()}_${record.id}.json`
  await fs.writeFile(path.join(tokenDirectory, filename), `${JSON.stringify(record, null, 2)}\n`, 'utf8')
}

export function buildWebhookUrls(req: NextApiRequest, token: string): Pick<WebhookCaptureListResponse, 'captureUrl' | 'inspectUrl'> {
  const safeToken = assertWebhookToken(token)
  const origin = getRequestOrigin(req)

  return {
    captureUrl: `${origin}/hook/${safeToken}`,
    inspectUrl: `${origin}/webhook/${safeToken}`,
  }
}

export async function captureWebhookRequest(
  req: NextApiRequest,
  token: string,
  pathSegments: string[]
): Promise<{ record: WebhookCaptureRecord; responsePayload: Record<string, unknown> }> {
  const safeToken = assertWebhookToken(token)
  const requestId = randomUUID()
  const receivedAt = new Date().toISOString()
  const origin = getRequestOrigin(req)
  const { captureUrl, inspectUrl } = buildWebhookUrls(req, safeToken)
  const method = req.method?.toUpperCase() || 'GET'
  const rawBody = await readRawBody(req)
  const { token: _token, path: _path, ...queryWithoutRouteParams } = req.query
  const pathValue = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '/'
  const requestUrl = `${origin}${req.url || `/hook/${safeToken}`}`

  const responsePayload: Record<string, unknown> = {
    ok: true,
    message: 'Request captured',
    token: safeToken,
    requestId,
    receivedAt,
    method,
    path: pathValue,
    requestUrl,
    captureUrl,
    inspectUrl,
  }

  const response: WebhookResponseInfo = {
    statusCode: 200,
    headers: JSON_RESPONSE_HEADERS,
    body: responsePayload,
    text: JSON.stringify(responsePayload, null, 2),
  }

  const record: WebhookCaptureRecord = {
    id: requestId,
    token: safeToken,
    receivedAt,
    method,
    path: pathValue,
    url: requestUrl,
    query: normalizeQuery(queryWithoutRouteParams),
    headers: normalizeHeaders(req.headers),
    cookies: parseCookies(getSingleHeaderValue(req.headers.cookie)),
    ip: getClientIpAddress(req),
    body: buildStoredBody(rawBody, getSingleHeaderValue(req.headers['content-type'])),
    response,
  }

  await persistWebhookRecord(safeToken, record)

  return {
    record,
    responsePayload,
  }
}

export async function listStoredWebhookRequests(
  req: NextApiRequest,
  token: string
): Promise<WebhookCaptureListResponse> {
  const safeToken = assertWebhookToken(token)
  const tokenDirectory = getTokenDirectory(safeToken)
  const { captureUrl, inspectUrl } = buildWebhookUrls(req, safeToken)

  try {
    const filenames = (await fs.readdir(tokenDirectory))
      .filter((filename) => filename.endsWith('.json'))
      .sort((left, right) => right.localeCompare(left))

    const requests = await Promise.all(
      filenames.map(async (filename) => {
        const content = await fs.readFile(path.join(tokenDirectory, filename), 'utf8')
        return JSON.parse(content) as WebhookCaptureRecord
      })
    )

    return {
      token: safeToken,
      captureUrl,
      inspectUrl,
      requests,
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {
        token: safeToken,
        captureUrl,
        inspectUrl,
        requests: [],
      }
    }

    throw error
  }
}

export async function clearStoredWebhookRequests(token: string): Promise<void> {
  const safeToken = assertWebhookToken(token)
  await fs.rm(getTokenDirectory(safeToken), { recursive: true, force: true })
}
