import { createHash, randomUUID, timingSafeEqual } from 'crypto'
import { promises as fsp } from 'fs'
import path from 'path'
import type { NextApiRequest } from 'next'
import type {
  WebhookAuthConfig,
  WebhookAuthHeader,
  WebhookAuthQueryParam,
  WebhookBlockedRecord,
} from '@/types/webhook'
import { collectSenderInfo, getStorageRoot, getWebhookRetentionHours } from '@/utils/webhookInbox'
import { isValidWebhookToken } from '@/utils/webhookToken'

const MAX_AUTH_HEADERS = 10
const MAX_HEADER_NAME_LENGTH = 128
const MAX_HEADER_VALUE_LENGTH = 1024
const HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/

export const MAX_AUTH_QUERY_PARAMS = 10
const MAX_QUERY_NAME_LENGTH = 128
const MAX_QUERY_VALUE_LENGTH = 1024
// Deliberately narrower than what a URL allows: an auth key is something we
// generate or a user types, so restricting it to unreserved URL characters
// keeps the name safe to drop into a query string without any escaping and
// leaves no room for separators (& = ? #) that could split one param into two.
const QUERY_NAME_PATTERN = /^[A-Za-z0-9_.~-]+$/

// `token` and `path` are the Next.js route parameters of the capture route
// (/api/hook/[token]/[[...path]]), so req.query carries them whether or not the
// sender supplied them. Allowing either as an auth key would mean matching
// against routing data instead of the caller's query string.
// `__proto__`/`constructor`/`prototype` can never reach an object literal here
// (matching runs off a Map), but they are rejected at the door so a stored
// config can never carry one into some future consumer that does use an object.
const RESERVED_QUERY_NAMES = new Set([
  'token',
  'path',
  '__proto__',
  'constructor',
  'prototype',
])

// Cap what a rejected request can write into the blocked-attempt log. The log
// is memory-only and attacker-controlled, so the URL is truncated as well as
// stripped of control characters (see sanitizeLoggedUrl).
const MAX_LOGGED_URL_LENGTH = 2048

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
  return { enabled: false, headers: [], queryEnabled: false, queryParams: [], updatedAt: null }
}

// Auth config lives outside the per-token capture dir so "Clear Inbox"
// (which removes that dir) never wipes the access rules.
function getAuthConfigDir(): string {
  return path.join(getStorageRoot(), '_auth')
}

function getAuthConfigPath(token: string): string {
  return path.join(getAuthConfigDir(), `${token}.json`)
}

function sanitizeNameValueList<T extends { name: string; value: string }>(
  value: unknown,
  limit: number
): T[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(
      (entry): entry is T =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as T).name === 'string' &&
        typeof (entry as T).value === 'string'
    )
    .map((entry) => ({ name: entry.name, value: entry.value }) as T)
    .slice(0, limit)
}

// Config files written before query-param auth existed have no queryEnabled or
// queryParams key; they load as "query auth off" and keep working untouched.
function sanitizeStoredConfig(value: unknown): WebhookAuthConfig {
  if (!value || typeof value !== 'object') {
    return defaultAuthConfig()
  }
  const raw = value as Partial<WebhookAuthConfig>
  const headers = sanitizeNameValueList<WebhookAuthHeader>(raw.headers, MAX_AUTH_HEADERS)
  const queryParams = sanitizeNameValueList<WebhookAuthQueryParam>(
    raw.queryParams,
    MAX_AUTH_QUERY_PARAMS
  )

  return {
    enabled: Boolean(raw.enabled) && headers.length > 0,
    headers,
    queryEnabled: Boolean(raw.queryEnabled) && queryParams.length > 0,
    queryParams,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

export interface WebhookAuthValidationError {
  error: string
}

export type WebhookAuthConfigInput = Pick<
  WebhookAuthConfig,
  'enabled' | 'headers' | 'queryEnabled' | 'queryParams'
>

// A control character in a name or value would let a stored config smuggle a
// newline into anything that later prints it (logs, a copied curl command) and
// can never be part of a legitimate header or query value.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/
const CONTROL_CHARACTERS_GLOBAL = /[\u0000-\u001F\u007F]/g

function validateHeaderList(value: unknown): WebhookAuthHeader[] | WebhookAuthValidationError {
  if (!Array.isArray(value)) {
    return { error: '"headers" must be an array of { name, value } objects' }
  }

  if (value.length > MAX_AUTH_HEADERS) {
    return { error: `A maximum of ${MAX_AUTH_HEADERS} authorization headers is allowed` }
  }

  const headers: WebhookAuthHeader[] = []
  const seenNames = new Set<string>()

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Each header must be an object with "name" and "value"' }
    }
    const name = String((entry as { name?: unknown }).name ?? '').trim()
    const headerValue = String((entry as { value?: unknown }).value ?? '').trim()

    if (!name || !headerValue) {
      return { error: 'Header name and value are both required' }
    }
    if (name.length > MAX_HEADER_NAME_LENGTH || !HEADER_NAME_PATTERN.test(name)) {
      return { error: `"${name}" is not a valid HTTP header name` }
    }
    if (RESERVED_HEADER_NAMES.has(name.toLowerCase())) {
      return { error: `"${name}" is a reserved HTTP header and cannot be used for authorization` }
    }
    if (headerValue.length > MAX_HEADER_VALUE_LENGTH) {
      return { error: `Header values are limited to ${MAX_HEADER_VALUE_LENGTH} characters` }
    }
    if (CONTROL_CHARACTERS.test(headerValue)) {
      return { error: `Header "${name}" value contains characters that are not allowed` }
    }
    if (seenNames.has(name.toLowerCase())) {
      return { error: `Header "${name}" is listed more than once` }
    }

    seenNames.add(name.toLowerCase())
    headers.push({ name, value: headerValue })
  }

  return headers
}

function validateQueryParamList(
  value: unknown
): WebhookAuthQueryParam[] | WebhookAuthValidationError {
  if (!Array.isArray(value)) {
    return { error: '"queryParams" must be an array of { name, value } objects' }
  }

  if (value.length > MAX_AUTH_QUERY_PARAMS) {
    return { error: `A maximum of ${MAX_AUTH_QUERY_PARAMS} authorization query params is allowed` }
  }

  const queryParams: WebhookAuthQueryParam[] = []
  // Query-string keys are case-sensitive (unlike header names), so "key" and
  // "Key" are two different params and both may be configured.
  const seenNames = new Set<string>()

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Each query param must be an object with "name" and "value"' }
    }
    const name = String((entry as { name?: unknown }).name ?? '').trim()
    const paramValue = String((entry as { value?: unknown }).value ?? '').trim()

    if (!name || !paramValue) {
      return { error: 'Query param name and value are both required' }
    }
    if (name.length > MAX_QUERY_NAME_LENGTH || !QUERY_NAME_PATTERN.test(name)) {
      return {
        error: `"${name}" is not a valid query param name — use letters, digits, and _ . ~ - only`,
      }
    }
    if (RESERVED_QUERY_NAMES.has(name.toLowerCase())) {
      return { error: `"${name}" is a reserved query param and cannot be used for authorization` }
    }
    if (paramValue.length > MAX_QUERY_VALUE_LENGTH) {
      return { error: `Query param values are limited to ${MAX_QUERY_VALUE_LENGTH} characters` }
    }
    if (CONTROL_CHARACTERS.test(paramValue)) {
      return { error: `Query param "${name}" value contains characters that are not allowed` }
    }
    if (seenNames.has(name)) {
      return { error: `Query param "${name}" is listed more than once` }
    }

    seenNames.add(name)
    queryParams.push({ name, value: paramValue })
  }

  return queryParams
}

// Accepts the full config. `queryEnabled`/`queryParams` are optional so that
// clients written before query-param auth existed keep validating unchanged.
export function validateAuthConfigInput(
  input: unknown
): { config: WebhookAuthConfigInput } | WebhookAuthValidationError {
  if (!input || typeof input !== 'object') {
    return { error: 'Request body must be a JSON object' }
  }

  const raw = input as {
    enabled?: unknown
    headers?: unknown
    queryEnabled?: unknown
    queryParams?: unknown
  }
  const enabled = Boolean(raw.enabled)
  const queryEnabled = Boolean(raw.queryEnabled)

  const headers = validateHeaderList(raw.headers)
  if ('error' in headers) {
    return headers
  }

  const queryParams = validateQueryParamList(
    typeof raw.queryParams === 'undefined' ? [] : raw.queryParams
  )
  if ('error' in queryParams) {
    return queryParams
  }

  if (enabled && headers.length === 0) {
    return { error: 'Add at least one header before enabling authorized receiving' }
  }

  if (queryEnabled && queryParams.length === 0) {
    return { error: 'Add at least one query param before enabling query param authorization' }
  }

  return { config: { enabled, headers, queryEnabled, queryParams } }
}

// Validates only the query half. Used by /api/webhook/[token]/auth-query, which
// merges its result into the stored config and leaves the header half alone.
export function validateAuthQueryConfigInput(
  input: unknown
): { config: Pick<WebhookAuthConfig, 'queryEnabled' | 'queryParams'> } | WebhookAuthValidationError {
  if (!input || typeof input !== 'object') {
    return { error: 'Request body must be a JSON object' }
  }

  const raw = input as { enabled?: unknown; queryEnabled?: unknown; queryParams?: unknown }
  // `enabled` is accepted as an alias so this endpoint reads naturally on its
  // own ({ enabled, queryParams }) as well as with the shared field name.
  const queryEnabled = Boolean(
    typeof raw.queryEnabled === 'undefined' ? raw.enabled : raw.queryEnabled
  )

  const queryParams = validateQueryParamList(raw.queryParams)
  if ('error' in queryParams) {
    return queryParams
  }

  if (queryEnabled && queryParams.length === 0) {
    return { error: 'Add at least one query param before enabling query param authorization' }
  }

  return { config: { queryEnabled, queryParams } }
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
  input: WebhookAuthConfigInput
): Promise<WebhookAuthConfig> {
  const safeToken = assertWebhookToken(token)
  const config: WebhookAuthConfig = {
    enabled: input.enabled && input.headers.length > 0,
    headers: input.headers,
    queryEnabled: input.queryEnabled && input.queryParams.length > 0,
    queryParams: input.queryParams,
    updatedAt: new Date().toISOString(),
  }

  getAuthConfigStore().set(safeToken, config)

  await fsp.mkdir(getAuthConfigDir(), { recursive: true })
  await fsp.writeFile(getAuthConfigPath(safeToken), `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  return config
}

// Replaces only the query half of the config, keeping whatever header rules are
// already stored. This is what /api/webhook/[token]/auth-query writes through,
// so a caller can manage query params without having to resend the headers
// (and without risking clobbering them with a stale copy).
export async function saveWebhookAuthQueryConfig(
  token: string,
  input: Pick<WebhookAuthConfig, 'queryEnabled' | 'queryParams'>
): Promise<WebhookAuthConfig> {
  const current = await getWebhookAuthConfig(token)

  return saveWebhookAuthConfig(token, {
    enabled: current.enabled,
    headers: current.headers,
    queryEnabled: input.queryEnabled,
    queryParams: input.queryParams,
  })
}

// Turns the query requirement off and drops the params, leaving header auth
// exactly as it was.
export async function clearWebhookAuthQueryConfig(token: string): Promise<WebhookAuthConfig> {
  return saveWebhookAuthQueryConfig(token, { queryEnabled: false, queryParams: [] })
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

// Reads the query string off req.url rather than req.query. On the capture
// route (/api/hook/[token]/[[...path]]) req.query also carries the route
// parameters, so a param named "token" there would resolve to the inbox token
// instead of anything the caller sent. Parsing the raw URL sees only what the
// sender actually put on the wire.
export function collectRequestQueryParams(req: NextApiRequest): Map<string, string[]> {
  const collected = new Map<string, string[]>()
  const url = typeof req.url === 'string' ? req.url : ''
  const questionMarkIndex = url.indexOf('?')

  if (questionMarkIndex === -1) {
    return collected
  }

  // A fragment is never sent by a client, but strip it defensively so a "#" in
  // a crafted request line cannot end up inside a parsed value.
  const rawQuery = url.slice(questionMarkIndex + 1).split('#')[0]

  for (const [name, value] of new URLSearchParams(rawQuery)) {
    const existing = collected.get(name)
    if (existing) {
      existing.push(value)
    } else {
      collected.set(name, [value])
    }
  }

  return collected
}

export type WebhookAuthCheckResult =
  | { ok: true }
  | {
      ok: false
      missingHeaders: string[]
      mismatchedHeaders: string[]
      missingQueryParams: string[]
      mismatchedQueryParams: string[]
    }

export function checkWebhookAuth(
  req: NextApiRequest,
  config: WebhookAuthConfig
): WebhookAuthCheckResult {
  const headerCheckRequired = config.enabled && config.headers.length > 0
  const queryCheckRequired = config.queryEnabled && config.queryParams.length > 0

  if (!headerCheckRequired && !queryCheckRequired) {
    return { ok: true }
  }

  const missingHeaders: string[] = []
  const mismatchedHeaders: string[] = []
  const missingQueryParams: string[] = []
  const mismatchedQueryParams: string[] = []

  // Evaluate every required header (no early return) so response timing does
  // not reveal which header failed first.
  if (headerCheckRequired) {
    for (const { name, value } of config.headers) {
      const actual = getSingleHeaderValue(req.headers[name.toLowerCase()])
      if (actual === null) {
        missingHeaders.push(name)
      } else if (!safeEqual(actual.trim(), value)) {
        mismatchedHeaders.push(name)
      }
    }
  }

  // Same no-early-return rule for query params. Names are matched case
  // sensitively because that is how query strings work — "?key=" and "?Key="
  // are different params to every HTTP stack in the chain.
  if (queryCheckRequired) {
    const provided = collectRequestQueryParams(req)

    for (const { name, value } of config.queryParams) {
      const actual = provided.get(name)
      if (!actual || actual.length === 0) {
        missingQueryParams.push(name)
      } else if (actual.length > 1) {
        // HTTP parameter pollution: a caller that repeats a required param is
        // rejected outright rather than us picking one of the values, since
        // different layers in front of the app disagree about which wins.
        mismatchedQueryParams.push(name)
      } else if (!safeEqual(actual[0].trim(), value)) {
        mismatchedQueryParams.push(name)
      }
    }
  }

  if (
    missingHeaders.length === 0 &&
    mismatchedHeaders.length === 0 &&
    missingQueryParams.length === 0 &&
    mismatchedQueryParams.length === 0
  ) {
    return { ok: true }
  }

  return {
    ok: false,
    missingHeaders,
    mismatchedHeaders,
    missingQueryParams,
    mismatchedQueryParams,
  }
}

const REDACTED_QUERY_VALUE = '***'

// The blocked-attempt log is rendered back in the inspector, so nothing
// attacker-controlled may reach it verbatim. Two things happen here:
//  * the value of every configured auth query param is replaced with ***, so a
//    near-miss attempt (or the correct secret alongside a failed header) never
//    ends up sitting in the log in plaintext; and
//  * control characters are stripped and the whole string is truncated, so a
//    crafted request line cannot inject newlines into logs or grow the
//    in-memory log without bound.
function sanitizeLoggedUrl(rawUrl: string, config?: WebhookAuthConfig): string {
  const stripped = rawUrl.replace(CONTROL_CHARACTERS_GLOBAL, '')
  const questionMarkIndex = stripped.indexOf('?')
  const secretNames = new Set((config?.queryParams ?? []).map((param) => param.name))

  let result = stripped

  if (questionMarkIndex !== -1 && secretNames.size > 0) {
    const pathPart = stripped.slice(0, questionMarkIndex)
    const [queryPart = '', ...fragmentParts] = stripped.slice(questionMarkIndex + 1).split('#')
    const redacted = queryPart
      .split('&')
      .map((pair) => {
        if (!pair) return pair
        const equalsIndex = pair.indexOf('=')
        const rawName = equalsIndex === -1 ? pair : pair.slice(0, equalsIndex)
        let decodedName = rawName
        try {
          decodedName = decodeURIComponent(rawName.replace(/\+/g, ' '))
        } catch {
          /* keep the raw name when the caller sent invalid percent-encoding */
        }
        return secretNames.has(decodedName) ? `${rawName}=${REDACTED_QUERY_VALUE}` : pair
      })
      .join('&')

    result = `${pathPart}?${redacted}${fragmentParts.length > 0 ? `#${fragmentParts.join('#')}` : ''}`
  }

  return result.length > MAX_LOGGED_URL_LENGTH
    ? `${result.slice(0, MAX_LOGGED_URL_LENGTH)}…`
    : result
}

function describeFailureReason(
  failure: Extract<WebhookAuthCheckResult, { ok: false }>
): WebhookBlockedRecord['reason'] {
  if (failure.missingHeaders.length > 0) return 'missing-header'
  if (failure.mismatchedHeaders.length > 0) return 'header-mismatch'
  if (failure.missingQueryParams.length > 0) return 'missing-query-param'
  return 'query-param-mismatch'
}

export function recordBlockedAttempt(
  req: NextApiRequest,
  token: string,
  pathSegments: string[],
  failure: Extract<WebhookAuthCheckResult, { ok: false }>,
  config?: WebhookAuthConfig
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
    url: sanitizeLoggedUrl(req.url || `/hook/${safeToken}`, config),
    ip: sender.callbackSenderIp || sender.ip,
    ipSource: sender.callbackSenderIpSource || sender.ipSource,
    userAgent: sender.userAgent,
    clientApp: sender.clientApp,
    host: sender.host,
    origin: sender.origin,
    reason: describeFailureReason(failure),
    missingHeaders: failure.missingHeaders,
    mismatchedHeaders: failure.mismatchedHeaders,
    missingQueryParams: failure.missingQueryParams,
    mismatchedQueryParams: failure.mismatchedQueryParams,
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

// Same retention window as captured requests (see pruneExpiredWebhookRecords)
// — blocked-attempt logs have no disk footprint, but should age out on the
// same schedule so the inbox doesn't show unauthorized attempts from weeks ago.
export function pruneExpiredBlockedAttempts(): void {
  const store = getBlockedStore()
  const cutoff = Date.now() - getWebhookRetentionHours() * 60 * 60 * 1000

  for (const [token, records] of store) {
    const kept = records.filter((record) => new Date(record.receivedAt).getTime() >= cutoff)
    if (kept.length === 0) {
      store.delete(token)
    } else if (kept.length !== records.length) {
      store.set(token, kept)
    }
  }
}
