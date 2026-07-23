import { randomUUID } from 'crypto'
import { promises as dns } from 'dns'
import { createWriteStream, promises as fsp, type WriteStream } from 'fs'
import path from 'path'
import type { IncomingHttpHeaders } from 'http'
import type { ParsedUrlQuery } from 'querystring'
import type { NextApiRequest } from 'next'
import type {
  WebhookCaptureListResponse,
  WebhookCaptureRecord,
  WebhookForwardedInfo,
  WebhookResponseInfo,
  WebhookSenderGeo,
  WebhookSenderInfo,
  WebhookStoredBody,
} from '@/types/webhook'
import { isValidWebhookToken } from '@/utils/webhookToken'

const JSON_RESPONSE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
}
const ONE_GB = 1024 * 1024 * 1024

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const MAX_WEBHOOK_BODY_BYTES = readPositiveIntEnv('WEBHOOK_MAX_BODY_BYTES', ONE_GB)
const INLINE_BODY_THRESHOLD = readPositiveIntEnv('WEBHOOK_INLINE_BODY_BYTES', 256 * 1024)
const MAX_WEBHOOK_RECORDS_PER_TOKEN = readPositiveIntEnv('WEBHOOK_MAX_RECORDS_PER_TOKEN', 100)
const BODY_PREVIEW_BYTES = 4096
const PREVIEW_TEXT_CHARS = 2000

interface InternalRecord extends WebhookCaptureRecord {
  bodyFilePath?: string
}

type WebhookMemoryStore = Map<string, InternalRecord[]>

declare global {
  // eslint-disable-next-line no-var
  var webhookCaptureStore: WebhookMemoryStore | undefined
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeBasePath(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return '/valid-webhooks'
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.replace(/\/+$/, '')
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

    const rawValueJoined = rawValue.join('=') || ''
    let value: string
    try {
      value = decodeURIComponent(rawValueJoined)
    } catch {
      value = rawValueJoined
    }

    cookies[rawKey] = value
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

  if (decoded.includes('�')) {
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

function buildInlinePreview(body: WebhookStoredBody): string | null {
  if (body.format === 'binary') {
    return `[binary payload, ${body.sizeBytes} bytes]`
  }

  if (body.format === 'json') {
    return JSON.stringify(body.json, null, 2).slice(0, PREVIEW_TEXT_CHARS)
  }

  return body.text ? body.text.slice(0, PREVIEW_TEXT_CHARS) : null
}

function buildInlineStoredBody(buffer: Buffer, contentTypeHeader: string | null): WebhookStoredBody {
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
      truncated: false,
      downloadUrl: null,
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
      truncated: false,
      downloadUrl: null,
    }

    storedBody.preview = buildInlinePreview(storedBody)
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
    truncated: false,
    downloadUrl: null,
  }

  storedBody.preview = buildInlinePreview(storedBody)
  return storedBody
}

function buildDiskStoredBody(args: {
  sizeBytes: number
  headSample: Buffer
  contentTypeHeader: string | null
  downloadUrl: string
}): WebhookStoredBody {
  const { sizeBytes, headSample, contentTypeHeader, downloadUrl } = args
  const contentType = contentTypeHeader?.split(';')[0]?.trim().toLowerCase() || null
  const probablyText =
    isTextualContentType(contentType) || (!contentType && looksMostlyText(headSample))

  if (probablyText) {
    const sample = headSample.toString('utf8')
    const trimmed = sample.length > PREVIEW_TEXT_CHARS ? sample.slice(0, PREVIEW_TEXT_CHARS) : sample
    const preview = `${trimmed}\n\n… body truncated for inline view — ${sizeBytes.toLocaleString()} bytes total. Use the Download button to fetch the full payload.`

    return {
      format: 'text',
      encoding: 'utf8',
      sizeBytes,
      contentType,
      text: null,
      json: null,
      base64: null,
      preview,
      truncated: true,
      downloadUrl,
    }
  }

  return {
    format: 'binary',
    encoding: 'base64',
    sizeBytes,
    contentType,
    text: null,
    json: null,
    base64: null,
    preview: `[binary payload, ${sizeBytes.toLocaleString()} bytes — use the Download button to fetch]`,
    truncated: true,
    downloadUrl,
  }
}

function slimBodyForList(body: WebhookStoredBody): WebhookStoredBody {
  if (body.truncated) {
    return body
  }

  if (body.sizeBytes <= INLINE_BODY_THRESHOLD) {
    return body
  }

  return {
    ...body,
    text: null,
    json: null,
    base64: null,
    truncated: true,
  }
}

function getRequestOrigin(req: NextApiRequest): string {
  const forwardedProto = getSingleHeaderValue(req.headers['x-forwarded-proto'])?.split(',')[0]?.trim()
  const forwardedHost = getSingleHeaderValue(req.headers['x-forwarded-host'])?.split(',')[0]?.trim()
  const host = forwardedHost || req.headers.host || 'localhost:3000'
  const protocol = forwardedProto || ((req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http')

  return `${protocol}://${host}`
}

function getConfiguredPublicApiOrigin(req: NextApiRequest): string {
  return normalizeOrigin(process.env.WEBHOOK_PUBLIC_API_ORIGIN || getRequestOrigin(req))
}

function getConfiguredInspectorOrigin(req: NextApiRequest): string {
  return normalizeOrigin(process.env.WEBHOOK_INSPECTOR_ORIGIN || getRequestOrigin(req))
}

function getConfiguredInspectorBasePath(): string {
  return normalizeBasePath(process.env.WEBHOOK_INSPECTOR_BASE_PATH || '/valid-webhooks')
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim().replace(/^::ffff:/i, '')
  return trimmed || null
}

const CLIENT_IP_HEADER_CANDIDATES = [
  'cf-connecting-ip',
  'true-client-ip',
  'fastly-client-ip',
  'fly-client-ip',
  'x-real-ip',
  'x-client-ip',
  'x-appengine-user-ip',
  'x-azure-clientip',
] as const

const DEFAULT_CALLBACK_SENDER_IP_HEADER = 'fly-client-ip'

const PROXY_HEADER_NAMES = [
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
  'x-forwarded-port',
  'forwarded',
  'via',
  'x-real-ip',
  'x-client-ip',
  'true-client-ip',
  'cf-connecting-ip',
  'cf-ray',
  'cf-ipcountry',
  'cf-visitor',
  'cf-worker',
  'fastly-client-ip',
  'fly-client-ip',
  'fly-forwarded-proto',
  'x-vercel-id',
  'x-vercel-forwarded-for',
  'x-vercel-ip-country',
  'x-vercel-ip-country-region',
  'x-vercel-ip-city',
  'x-vercel-ip-latitude',
  'x-vercel-ip-longitude',
  'x-vercel-ip-timezone',
  'x-amzn-trace-id',
  'x-amz-cf-id',
  'x-request-id',
  'x-correlation-id',
  'x-railway-request-id',
  'x-render-origin-server',
  'x-appengine-user-ip',
  'x-appengine-country',
  'x-appengine-region',
  'x-appengine-city',
  'x-appengine-citylatlong',
  'x-azure-clientip',
  'x-azure-socketip',
] as const

const SIGNATURE_HEADER_PATTERN = /(signature|hmac|digest|x-hub-signature|x-webhook|idempotency-key|event-id|delivery)/i

const CLIENT_APP_PATTERNS: Array<[RegExp, string]> = [
  [/github-hookshot/i, 'GitHub webhooks'],
  [/stripe/i, 'Stripe webhooks'],
  [/razorpay/i, 'Razorpay webhooks'],
  [/shopify/i, 'Shopify webhooks'],
  [/twilio/i, 'Twilio'],
  [/paypal/i, 'PayPal'],
  [/slack/i, 'Slack'],
  [/postmanruntime/i, 'Postman'],
  [/insomnia/i, 'Insomnia'],
  [/curl\//i, 'curl'],
  [/wget/i, 'Wget'],
  [/axios/i, 'axios'],
  [/node-fetch|undici|node\.js/i, 'Node.js HTTP client'],
  [/go-http-client/i, 'Go HTTP client'],
  [/python-requests/i, 'Python requests'],
  [/python-urllib|python-httpx|\bhttpx\b|aiohttp/i, 'Python HTTP client'],
  [/okhttp/i, 'OkHttp (Java/Android)'],
  [/apache-httpclient|java\//i, 'Java HTTP client'],
  [/guzzlehttp/i, 'Guzzle (PHP)'],
  [/dart:io|dart\//i, 'Dart/Flutter HTTP client'],
  [/mozilla\/.*(chrome|safari|firefox|edg|opr)/i, 'Web browser'],
]

function detectClientApp(userAgent: string | null): string | null {
  if (!userAgent) {
    return null
  }

  for (const [pattern, label] of CLIENT_APP_PATTERNS) {
    if (pattern.test(userAgent)) {
      return label
    }
  }

  return null
}

function parseForwardedHeader(raw: string | null): WebhookForwardedInfo {
  const info: WebhookForwardedInfo = { for: [], proto: null, host: null, port: null, raw }

  if (!raw) {
    return info
  }

  for (const element of raw.split(',')) {
    for (const pair of element.split(';')) {
      const [rawKey, ...rawValue] = pair.split('=')
      const key = rawKey?.trim().toLowerCase()
      const value = rawValue.join('=').trim().replace(/^"|"$/g, '')

      if (!key || !value) {
        continue
      }

      if (key === 'for') {
        info.for.push(value)
      } else if (key === 'proto' && !info.proto) {
        info.proto = value
      } else if (key === 'host' && !info.host) {
        info.host = value
      } else if (key === 'port' && !info.port) {
        info.port = value
      }
    }
  }

  return info
}

function collectGeoHints(req: NextApiRequest): WebhookSenderGeo | null {
  const header = (name: string) => getSingleHeaderValue(req.headers[name])

  if (header('cf-ipcountry')) {
    return {
      country: header('cf-ipcountry'),
      region: null,
      city: null,
      latitude: null,
      longitude: null,
      timezone: null,
      source: 'Cloudflare headers',
    }
  }

  if (header('x-vercel-ip-country')) {
    return {
      country: header('x-vercel-ip-country'),
      region: header('x-vercel-ip-country-region'),
      city: header('x-vercel-ip-city'),
      latitude: header('x-vercel-ip-latitude'),
      longitude: header('x-vercel-ip-longitude'),
      timezone: header('x-vercel-ip-timezone'),
      source: 'Vercel headers',
    }
  }

  if (header('x-appengine-country')) {
    const [latitude, longitude] = (header('x-appengine-citylatlong') || '').split(',')
    return {
      country: header('x-appengine-country'),
      region: header('x-appengine-region'),
      city: header('x-appengine-city'),
      latitude: latitude?.trim() || null,
      longitude: longitude?.trim() || null,
      timezone: null,
      source: 'Google App Engine headers',
    }
  }

  return null
}

function resolveClientIp(req: NextApiRequest): { ip: string | null; ipSource: string | null } {
  for (const headerName of CLIENT_IP_HEADER_CANDIDATES) {
    const value = normalizeIp(getSingleHeaderValue(req.headers[headerName])?.split(',')[0])
    if (value) {
      return { ip: value, ipSource: `${headerName} header` }
    }
  }

  const forwardedFor = normalizeIp(getSingleHeaderValue(req.headers['x-forwarded-for'])?.split(',')[0])
  if (forwardedFor) {
    return { ip: forwardedFor, ipSource: 'x-forwarded-for header' }
  }

  const forwarded = parseForwardedHeader(getSingleHeaderValue(req.headers.forwarded))
  const forwardedIp = normalizeIp(forwarded.for[0]?.replace(/^\[|\]$/g, '').split(']:')[0]?.split(':')[0])
  if (forwardedIp) {
    return { ip: forwardedIp, ipSource: 'forwarded header' }
  }

  const socketIp = normalizeIp(req.socket.remoteAddress)
  if (socketIp) {
    return { ip: socketIp, ipSource: 'socket remote address' }
  }

  return { ip: null, ipSource: null }
}

function resolveFlyClientIp(req: NextApiRequest): { ip: string | null; ipSource: string | null } {
  const ip = normalizeIp(getSingleHeaderValue(req.headers['fly-client-ip'])?.split(',')[0])
  return {
    ip,
    ipSource: ip ? 'fly-client-ip header' : null,
  }
}

function getConfiguredCallbackSenderIpHeaders(): string[] {
  const configured = process.env.WEBHOOK_CALLBACK_SENDER_IP_HEADER || DEFAULT_CALLBACK_SENDER_IP_HEADER
  const headerNames = configured
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  return headerNames.length > 0 ? headerNames : [DEFAULT_CALLBACK_SENDER_IP_HEADER]
}

function resolveCallbackSenderIp(
  req: NextApiRequest,
  fallback: { ip: string | null; ipSource: string | null }
): { ip: string | null; ipSource: string | null } {
  for (const headerName of getConfiguredCallbackSenderIpHeaders()) {
    const ip = normalizeIp(getSingleHeaderValue(req.headers[headerName])?.split(',')[0])
    if (ip) {
      return { ip, ipSource: `${headerName} header` }
    }
  }

  return fallback
}

function parseContentLength(value: string | null): number | null {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function collectSenderInfo(req: NextApiRequest): WebhookSenderInfo {
  const header = (name: string) => getSingleHeaderValue(req.headers[name])
  const { ip, ipSource } = resolveClientIp(req)
  const callbackSender = resolveCallbackSenderIp(req, { ip, ipSource })
  const flyClient = resolveFlyClientIp(req)
  const remoteAddress = normalizeIp(req.socket.remoteAddress)

  const forwardedForChain = (header('x-forwarded-for') || '')
    .split(',')
    .map((entry) => normalizeIp(entry))
    .filter((entry): entry is string => Boolean(entry))

  const ipChain = [...forwardedForChain]
  if (remoteAddress && !ipChain.includes(remoteAddress)) {
    ipChain.push(remoteAddress)
  }

  const flyForwardedIp =
    [...forwardedForChain].reverse().find((entry) => entry !== callbackSender.ip) || null

  const proxyHeaders: Record<string, string> = {}
  for (const name of PROXY_HEADER_NAMES) {
    const value = header(name)
    if (value) {
      proxyHeaders[name] = value
    }
  }

  const signatureHeaders: Record<string, string> = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value !== 'undefined' && SIGNATURE_HEADER_PATTERN.test(name)) {
      signatureHeaders[name] = Array.isArray(value) ? value.join(', ') : value
    }
  }

  const secureConnection = Boolean((req.socket as { encrypted?: boolean }).encrypted)
  const forwardedProto = header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const protocol: 'http' | 'https' =
    forwardedProto === 'https' || forwardedProto === 'http'
      ? forwardedProto
      : secureConnection
        ? 'https'
        : 'http'

  const userAgent = header('user-agent')

  return {
    ip,
    ipSource,
    callbackSenderIp: callbackSender.ip,
    callbackSenderIpSource: callbackSender.ipSource,
    flyClientIp: flyClient.ip,
    flyForwardedIp,
    flyProxyIp: remoteAddress,
    ipChain,
    remoteAddress,
    remotePort: req.socket.remotePort ?? null,
    remoteFamily: req.socket.remoteFamily ?? null,
    reverseDns: null,
    userAgent,
    clientApp: detectClientApp(userAgent),
    httpVersion: req.httpVersion || null,
    protocol,
    secureConnection,
    host: header('x-forwarded-host')?.split(',')[0]?.trim() || header('host'),
    origin: header('origin'),
    referer: header('referer') || header('referrer'),
    accept: header('accept'),
    acceptLanguage: header('accept-language'),
    acceptEncoding: header('accept-encoding'),
    contentType: header('content-type'),
    contentLength: parseContentLength(header('content-length')),
    transferEncoding: header('transfer-encoding'),
    connection: header('connection'),
    authorizationPresent: Boolean(header('authorization') || header('proxy-authorization')),
    signatureHeaders,
    forwarded: parseForwardedHeader(header('forwarded')),
    proxyHeaders,
    geo: collectGeoHints(req),
  }
}

const REVERSE_DNS_TIMEOUT_MS = 2000

// dns.reverse() runs on libuv's threadpool (default 4 threads, shared with fs
// ops), and the JS-side timeout below only stops *waiting* on it — the
// underlying OS call keeps the thread pinned until it actually returns. Under
// a burst of concurrent webhook callbacks, unbounded reverse lookups can
// starve the threadpool and stall response writes on every route (including
// unrelated fs reads), which shows up client-side as timeouts / broken pipes.
// Cap how many of our own lookups run at once and drop enrichment (rather
// than queue it unboundedly) once the backlog gets too deep — this is
// best-effort metadata for the inspector UI, not required to capture the
// callback.
const MAX_CONCURRENT_REVERSE_DNS_LOOKUPS = readPositiveIntEnv('WEBHOOK_MAX_CONCURRENT_REVERSE_DNS', 4)
const MAX_QUEUED_REVERSE_DNS_LOOKUPS = readPositiveIntEnv('WEBHOOK_MAX_QUEUED_REVERSE_DNS', 50)

let activeReverseDnsLookups = 0
const reverseDnsQueue: Array<() => void> = []

function runReverseDnsLookup(sender: WebhookSenderInfo, target: string): void {
  activeReverseDnsLookups += 1

  void (async () => {
    let timer: NodeJS.Timeout | undefined
    try {
      const names = await Promise.race([
        dns.reverse(target),
        new Promise<string[]>((_, reject) => {
          timer = setTimeout(() => reject(new Error('reverse DNS timeout')), REVERSE_DNS_TIMEOUT_MS)
          timer.unref?.()
        }),
      ])
      sender.reverseDns = names
    } catch {
      sender.reverseDns = []
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
      activeReverseDnsLookups -= 1
      const next = reverseDnsQueue.shift()
      if (next) {
        next()
      }
    }
  })()
}

function scheduleReverseDnsLookup(sender: WebhookSenderInfo): void {
  const target = sender.ip || sender.remoteAddress
  if (!target) {
    sender.reverseDns = []
    return
  }

  if (activeReverseDnsLookups < MAX_CONCURRENT_REVERSE_DNS_LOOKUPS) {
    runReverseDnsLookup(sender, target)
    return
  }

  if (reverseDnsQueue.length >= MAX_QUEUED_REVERSE_DNS_LOOKUPS) {
    sender.reverseDns = []
    return
  }

  reverseDnsQueue.push(() => runReverseDnsLookup(sender, target))
}

export function getStorageRoot(): string {
  return process.env.WEBHOOK_BODY_DIR || path.join(process.cwd(), 'data', 'webhook_inbox')
}

async function ensureTokenDir(token: string): Promise<string> {
  const dir = path.join(getStorageRoot(), token)
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

function buildBodyDownloadPath(token: string, requestId: string): string {
  return `/api/webhook/${encodeURIComponent(token)}/${encodeURIComponent(requestId)}/body`
}

type ReadBodyResult =
  | { kind: 'inline'; buffer: Buffer; sizeBytes: number }
  | { kind: 'disk'; filePath: string; sizeBytes: number; headSample: Buffer }

async function writeChunk(stream: WriteStream, chunk: Buffer): Promise<void> {
  if (stream.write(chunk)) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      stream.off('error', onError)
      resolve()
    }
    const onError = (err: Error) => {
      stream.off('drain', onDrain)
      reject(err)
    }
    stream.once('drain', onDrain)
    stream.once('error', onError)
  })
}

async function endStream(stream: WriteStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.once('error', reject)
    stream.end(() => resolve())
  })
}

async function readAndStoreBody(
  req: NextApiRequest,
  token: string,
  requestId: string
): Promise<ReadBodyResult> {
  const inlineChunks: Buffer[] = []
  let totalBytes = 0
  let spilling = false
  const streamRef: { current: WriteStream | null } = { current: null }
  let filePath = ''
  let headSample: Buffer = Buffer.alloc(0)

  const captureHead = (chunk: Buffer) => {
    if (headSample.length >= BODY_PREVIEW_BYTES) {
      return
    }
    const needed = BODY_PREVIEW_BYTES - headSample.length
    headSample = Buffer.concat([headSample, chunk.subarray(0, Math.min(needed, chunk.length))])
  }

  const spillToDisk = async () => {
    const dir = await ensureTokenDir(token)
    filePath = path.join(dir, `${requestId}.bin`)
    const stream = createWriteStream(filePath)
    streamRef.current = stream
    headSample = Buffer.concat(inlineChunks).subarray(0, BODY_PREVIEW_BYTES)
    for (const buffered of inlineChunks) {
      await writeChunk(stream, buffered)
    }
    inlineChunks.length = 0
    spilling = true
  }

  try {
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buffer.length

      if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
        throw Object.assign(new Error('Webhook body exceeds maximum allowed size'), {
          statusCode: 413,
        })
      }

      if (!spilling) {
        inlineChunks.push(buffer)
        if (totalBytes > INLINE_BODY_THRESHOLD) {
          await spillToDisk()
        }
      } else {
        await writeChunk(streamRef.current!, buffer)
        captureHead(buffer)
      }
    }

    if (streamRef.current) {
      await endStream(streamRef.current)
      return { kind: 'disk', filePath, sizeBytes: totalBytes, headSample }
    }

    return { kind: 'inline', buffer: Buffer.concat(inlineChunks), sizeBytes: totalBytes }
  } catch (err) {
    if (streamRef.current) {
      try {
        streamRef.current.destroy()
      } catch {
        /* ignore */
      }
      try {
        await fsp.unlink(filePath)
      } catch {
        /* ignore */
      }
    }
    throw err
  }
}

function getWebhookCaptureStore(): WebhookMemoryStore {
  if (!global.webhookCaptureStore) {
    global.webhookCaptureStore = new Map<string, InternalRecord[]>()
  }

  return global.webhookCaptureStore
}

async function persistWebhookRecord(token: string, record: InternalRecord): Promise<void> {
  const store = getWebhookCaptureStore()
  const currentRecords = store.get(token) || []
  const nextRecords = [record, ...currentRecords]
  const kept = nextRecords.slice(0, MAX_WEBHOOK_RECORDS_PER_TOKEN)
  const evicted = nextRecords.slice(MAX_WEBHOOK_RECORDS_PER_TOKEN)
  store.set(token, kept)

  for (const old of evicted) {
    if (old.bodyFilePath) {
      try {
        await fsp.unlink(old.bodyFilePath)
      } catch {
        /* ignore missing files */
      }
    }
  }
}

function publicRecord(record: InternalRecord, slimBody = false): WebhookCaptureRecord {
  const { bodyFilePath: _unused, ...rest } = record
  void _unused
  return {
    ...rest,
    body: slimBody ? slimBodyForList(rest.body) : rest.body,
  }
}

export function buildWebhookUrls(req: NextApiRequest, token: string): Pick<WebhookCaptureListResponse, 'captureUrl' | 'inspectUrl'> {
  const safeToken = assertWebhookToken(token)
  const apiOrigin = getConfiguredPublicApiOrigin(req)
  const inspectorOrigin = getConfiguredInspectorOrigin(req)
  const inspectorBasePath = getConfiguredInspectorBasePath()

  return {
    captureUrl: `${apiOrigin}${inspectorBasePath}/${safeToken}`,
    inspectUrl: `${inspectorOrigin}${inspectorBasePath}/${safeToken}`,
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
  const contentTypeHeader = getSingleHeaderValue(req.headers['content-type'])
  const sender = collectSenderInfo(req)

  const bodyResult = await readAndStoreBody(req, safeToken, requestId)

  let storedBody: WebhookStoredBody
  let bodyFilePath: string | undefined

  if (bodyResult.kind === 'inline') {
    storedBody = buildInlineStoredBody(bodyResult.buffer, contentTypeHeader)
  } else {
    bodyFilePath = bodyResult.filePath
    storedBody = buildDiskStoredBody({
      sizeBytes: bodyResult.sizeBytes,
      headSample: bodyResult.headSample,
      contentTypeHeader,
      downloadUrl: buildBodyDownloadPath(safeToken, requestId),
    })
  }

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
    senderIp: sender.ip,
    callbackSenderIp: sender.callbackSenderIp,
    callbackSenderIpSource: sender.callbackSenderIpSource,
    flyClientIp: sender.flyClientIp,
    flyForwardedIp: sender.flyForwardedIp,
    flyProxyIp: sender.flyProxyIp,
    sizeBytes: storedBody.sizeBytes,
    truncated: Boolean(storedBody.truncated),
  }

  const response: WebhookResponseInfo = {
    statusCode: 200,
    headers: JSON_RESPONSE_HEADERS,
    body: responsePayload,
    text: JSON.stringify(responsePayload, null, 2),
  }

  const record: InternalRecord = {
    id: requestId,
    token: safeToken,
    receivedAt,
    method,
    path: pathValue,
    url: requestUrl,
    query: normalizeQuery(queryWithoutRouteParams),
    headers: normalizeHeaders(req.headers),
    cookies: parseCookies(getSingleHeaderValue(req.headers.cookie)),
    ip: sender.ip,
    callbackSenderIp: sender.callbackSenderIp,
    sender,
    body: storedBody,
    response,
    bodyFilePath,
  }

  await persistWebhookRecord(safeToken, record)
  scheduleReverseDnsLookup(sender)

  return {
    record: publicRecord(record),
    responsePayload,
  }
}

export async function listStoredWebhookRequests(
  req: NextApiRequest,
  token: string
): Promise<WebhookCaptureListResponse> {
  const safeToken = assertWebhookToken(token)
  const { captureUrl, inspectUrl } = buildWebhookUrls(req, safeToken)
  const internalRecords = getWebhookCaptureStore().get(safeToken) || []
  const requests = internalRecords.map((record) => publicRecord(record, true))

  return {
    token: safeToken,
    captureUrl,
    inspectUrl,
    requests,
  }
}

export async function getStoredWebhookRequest(
  token: string,
  requestId: string
): Promise<{ record: WebhookCaptureRecord; bodyFilePath: string | null } | null> {
  const safeToken = assertWebhookToken(token)
  const records = getWebhookCaptureStore().get(safeToken) || []
  const record = records.find((r) => r.id === requestId)
  if (!record) {
    return null
  }
  return {
    record: publicRecord(record),
    bodyFilePath: record.bodyFilePath || null,
  }
}

export function getInlineBodyBuffer(body: WebhookStoredBody): Buffer {
  if (body.text !== null && body.text !== undefined) {
    return Buffer.from(body.text, 'utf8')
  }
  if (body.json !== null && body.json !== undefined) {
    return Buffer.from(JSON.stringify(body.json, null, 2), 'utf8')
  }
  if (body.base64) {
    return Buffer.from(body.base64, 'base64')
  }
  return Buffer.alloc(0)
}

export interface StoredWebhookBodySource {
  id: string
  receivedAt: string
  method: string
  contentType: string | null
  bodyFilePath: string | null
  inlineBody: Buffer | null
}

export function listStoredWebhookBodySources(token: string): StoredWebhookBodySource[] {
  const safeToken = assertWebhookToken(token)
  const records = getWebhookCaptureStore().get(safeToken) || []
  return records.map((record) => ({
    id: record.id,
    receivedAt: record.receivedAt,
    method: record.method,
    contentType: record.body.contentType,
    bodyFilePath: record.bodyFilePath || null,
    inlineBody: record.bodyFilePath ? null : getInlineBodyBuffer(record.body),
  }))
}

export async function clearStoredWebhookRequests(token: string): Promise<void> {
  const safeToken = assertWebhookToken(token)
  const store = getWebhookCaptureStore()
  const records = store.get(safeToken) || []
  store.delete(safeToken)

  for (const record of records) {
    if (record.bodyFilePath) {
      try {
        await fsp.unlink(record.bodyFilePath)
      } catch {
        /* ignore */
      }
    }
  }

  try {
    await fsp.rm(path.join(getStorageRoot(), safeToken), { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
