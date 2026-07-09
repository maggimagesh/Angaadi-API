import { createHash, randomUUID, timingSafeEqual } from 'crypto'
import { promises as fsp } from 'fs'
import path from 'path'
import type { NextApiRequest } from 'next'
import type {
  WebhookAuthConfig,
  WebhookAuthHeader,
  WebhookBlockedRecord,
} from '@/types/webhook'
import { collectSenderInfo, getStorageRoot } from '@/utils/webhookInbox'
import { isValidWebhookToken } from '@/utils/webhookToken'

const MAX_AUTH_HEADERS = 10
const MAX_HEADER_NAME_LENGTH = 128
const MAX_HEADER_VALUE_LENGTH = 1024
const HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/

// Headers set or rewritten by proxies/HTTP infrastructure — matching on them
// would silently break auth once the app sits behind a load balancer.
const RESERVED_HEADER_NAMES = new Set([
  'host',
  'connection',
  'content-length',
  'content-type',
  'transfer-encoding',
  'expect',
  'upgrade',
  'te',
  'trailer',
  'keep-alive',
])

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const MAX_BLOCKED_RECORDS_PER_TOKEN = readPositiveIntEnv('WEBHOOK_MAX_BLOCKED_PER_TOKEN', 100)

type WebhookAuthConfigStore = Map<string, WebhookAuthConfig>
type WebhookBlockedStore = Map<string, WebhookBlockedRecord[]>

declare global {
  // eslint-disable-next-line no-var
  var webhookAuthConfigStore: WebhookAuthConfigStore | undefined
  // eslint-disable-next-line no-var
  var webhookBlockedStore: WebhookBlockedStore | undefined
}

function getAuthConfigStore(): WebhookAuthConfigStore {
  if (!global.webhookAuthConfigStore) {
    global.webhookAuthConfigStore = new Map<string, WebhookAuthConfig>()
  }
  return global.webhookAuthConfigStore
}

function getBlockedStore(): WebhookBlockedStore {
  if (!global.webhookBlockedStore) {
    global.webhookBlockedStore = new Map<string, WebhookBlockedRecord[]>()
  }
  return global.webhookBlockedStore
}

function assertWebhookToken(token: string): string {
  if (!isValidWebhookToken(token)) {
    throw new Error('Invalid webhook token')
  }
  return token
}

function defaultAuthConfig(): WebhookAuthConfig {
  return { enabled: false, headers: [], updatedAt: null }
}

// Auth config lives outside the per-token capture dir so "Clear Inbox"
// (which removes that dir) never wipes the access rules.
function getAuthConfigDir(): string {
  return path.join(getStorageRoot(), '_auth')
}

function getAuthConfigPath(token: string): string {
  return path.join(getAuthConfigDir(), `${token}.json`)
}

function sanitizeStoredConfig(value: unknown): WebhookAuthConfig {
  if (!value || typeof value !== 'object') {
    return defaultAuthConfig()
  }
  const raw = value as Partial<WebhookAuthConfig>
  const headers = Array.isArray(raw.headers)
    ? raw.headers
        .filter(
          (entry): entry is WebhookAuthHeader =>
            Boolean(entry) &&
            typeof entry === 'object' &&
            typeof (entry as WebhookAuthHeader).name === 'string' &&
            typeof (entry as WebhookAuthHeader).value === 'string'
        )
        .slice(0, MAX_AUTH_HEADERS)
    : []

  return {
    enabled: Boolean(raw.enabled) && headers.length > 0,
    headers,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

export interface WebhookAuthValidationError {
  error: string
}

export function validateAuthConfigInput(
  input: unknown
): { config: Pick<WebhookAuthConfig, 'enabled' | 'headers'> } | WebhookAuthValidationError {
  if (!input || typeof input !== 'object') {
    return { error: 'Request body must be a JSON object' }
  }

  const raw = input as { enabled?: unknown; headers?: unknown }
  const enabled = Boolean(raw.enabled)

  if (!Array.isArray(raw.headers)) {
    return { error: '"headers" must be an array of { name, value } objects' }
  }

  if (raw.headers.length > MAX_AUTH_HEADERS) {
    return { error: `A maximum of ${MAX_AUTH_HEADERS} authorization headers is allowed` }
  }

  const headers: WebhookAuthHeader[] = []
  const seenNames = new Set<string>()

  for (const entry of raw.headers) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Each header must be an object with "name" and "value"' }
    }
    const name = String((entry as { name?: unknown }).name ?? '').trim()
    const value = String((entry as { value?: unknown }).value ?? '').trim()

    if (!name || !value) {
      return { error: 'Header name and value are both required' }
    }
    if (name.length > MAX_HEADER_NAME_LENGTH || !HEADER_NAME_PATTERN.test(name)) {
      return { error: `"${name}" is not a valid HTTP header name` }
    }
    if (RESERVED_HEADER_NAMES.has(name.toLowerCase())) {
      return { error: `"${name}" is a reserved HTTP header and cannot be used for authorization` }
    }
    if (value.length > MAX_HEADER_VALUE_LENGTH) {
      return { error: `Header values are limited to ${MAX_HEADER_VALUE_LENGTH} characters` }
    }
    if (seenNames.has(name.toLowerCase())) {
      return { error: `Header "${name}" is listed more than once` }
    }

    seenNames.add(name.toLowerCase())
    headers.push({ name, value })
  }

  if (enabled && headers.length === 0) {
    return { error: 'Add at least one header before enabling authorized receiving' }
  }

  return { config: { enabled, headers } }
}

export async function getWebhookAuthConfig(token: string): Promise<WebhookAuthConfig> {
  const safeToken = assertWebhookToken(token)
  const store = getAuthConfigStore()
  const cached = store.get(safeToken)
  if (cached) {
    return cached
  }

  try {
    const raw = await fsp.readFile(getAuthConfigPath(safeToken), 'utf8')
    const config = sanitizeStoredConfig(JSON.parse(raw))
    store.set(safeToken, config)
    return config
  } catch {
    const config = defaultAuthConfig()
    store.set(safeToken, config)
    return config
  }
}

export async function saveWebhookAuthConfig(
  token: string,
  input: Pick<WebhookAuthConfig, 'enabled' | 'headers'>
): Promise<WebhookAuthConfig> {
  const safeToken = assertWebhookToken(token)
  const config: WebhookAuthConfig = {
    enabled: input.enabled && input.headers.length > 0,
    headers: input.headers,
    updatedAt: new Date().toISOString(),
  }

  getAuthConfigStore().set(safeToken, config)

  await fsp.mkdir(getAuthConfigDir(), { recursive: true })
  await fsp.writeFile(getAuthConfigPath(safeToken), `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  return config
}

export async function clearWebhookAuthConfig(token: string): Promise<WebhookAuthConfig> {
  const safeToken = assertWebhookToken(token)
  const config = defaultAuthConfig()
  getAuthConfigStore().set(safeToken, config)

  try {
    await fsp.unlink(getAuthConfigPath(safeToken))
  } catch {
    /* ignore missing file */
  }

  return config
}

function safeEqual(left: string, right: string): boolean {
  // Hash both sides so the comparison is constant-time regardless of length.
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function getSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'undefined') {
    return null
  }
  return Array.isArray(value) ? value.join(', ') : value
}

export type WebhookAuthCheckResult =
  | { ok: true }
  | { ok: false; missingHeaders: string[]; mismatchedHeaders: string[] }

export function checkWebhookAuth(
  req: NextApiRequest,
  config: WebhookAuthConfig
): WebhookAuthCheckResult {
  if (!config.enabled || config.headers.length === 0) {
    return { ok: true }
  }

  const missingHeaders: string[] = []
  const mismatchedHeaders: string[] = []

  // Evaluate every required header (no early return) so response timing does
  // not reveal which header failed first.
  for (const { name, value } of config.headers) {
    const actual = getSingleHeaderValue(req.headers[name.toLowerCase()])
    if (actual === null) {
      missingHeaders.push(name)
    } else if (!safeEqual(actual.trim(), value)) {
      mismatchedHeaders.push(name)
    }
  }

  if (missingHeaders.length === 0 && mismatchedHeaders.length === 0) {
    return { ok: true }
  }

  return { ok: false, missingHeaders, mismatchedHeaders }
}

export function recordBlockedAttempt(
  req: NextApiRequest,
  token: string,
  pathSegments: string[],
  failure: Extract<WebhookAuthCheckResult, { ok: false }>
): WebhookBlockedRecord {
  const safeToken = assertWebhookToken(token)
  const sender = collectSenderInfo(req)
  const pathValue = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '/'

  const record: WebhookBlockedRecord = {
    id: randomUUID(),
    token: safeToken,
    receivedAt: new Date().toISOString(),
    method: req.method?.toUpperCase() || 'GET',
    path: pathValue,
    url: req.url || `/hook/${safeToken}`,
    ip: sender.callbackSenderIp || sender.ip,
    ipSource: sender.callbackSenderIpSource || sender.ipSource,
    userAgent: sender.userAgent,
    clientApp: sender.clientApp,
    host: sender.host,
    origin: sender.origin,
    reason: failure.missingHeaders.length > 0 ? 'missing-header' : 'header-mismatch',
    missingHeaders: failure.missingHeaders,
    mismatchedHeaders: failure.mismatchedHeaders,
  }

  const store = getBlockedStore()
  const current = store.get(safeToken) || []
  store.set(safeToken, [record, ...current].slice(0, MAX_BLOCKED_RECORDS_PER_TOKEN))

  return record
}

export function listBlockedAttempts(token: string): WebhookBlockedRecord[] {
  const safeToken = assertWebhookToken(token)
  return getBlockedStore().get(safeToken) || []
}

export function clearBlockedAttempts(token: string): number {
  const safeToken = assertWebhookToken(token)
  const store = getBlockedStore()
  const count = (store.get(safeToken) || []).length
  store.delete(safeToken)
  return count
}
