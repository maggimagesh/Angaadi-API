// Smoke / sanity tests: drive the real route handlers end to end and assert the
// headline paths work — configure a rule through the API, then have the capture
// route accept and reject callbacks accordingly.
import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'
import type { NextApiRequest } from 'next'
import type { WebhookAuthConfig } from '@/types/webhook'
import { captureUrl, mockRequest } from '../helpers/mockRequest.ts'
import { mockResponse } from '../helpers/mockResponse.ts'

const TOKEN = 'smoketokenaaaa01'
let storageRoot: string

// Imported lazily so the storage root is set before any module reads it.
type Handler = (req: NextApiRequest, res: ReturnType<typeof mockResponse>['res']) => Promise<void>
let authHandler: Handler
let authQueryHandler: Handler
let captureHandler: Handler
let blockedHandler: Handler

before(async () => {
  storageRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'webhook-auth-smoke-'))
  process.env.WEBHOOK_BODY_DIR = storageRoot

  authHandler = (await import('../../pages/api/webhook/[token]/auth.ts')).default as Handler
  authQueryHandler = (await import('../../pages/api/webhook/[token]/auth-query.ts'))
    .default as Handler
  captureHandler = (await import('../../pages/api/hook/[token]/[[...path]].ts')).default as Handler
  blockedHandler = (await import('../../pages/api/webhook/[token]/blocked.ts')).default as Handler
})

after(async () => {
  await fsp.rm(storageRoot, { recursive: true, force: true })
})

async function call(
  handler: Handler,
  options: {
    method: string
    url?: string
    query?: Record<string, string | string[]>
    body?: unknown
    headers?: Record<string, string>
  }
) {
  const req = mockRequest({
    method: options.method,
    url: options.url ?? `/api/webhook/${TOKEN}/auth`,
    headers: options.headers,
  })
  ;(req as unknown as { query: Record<string, string | string[]> }).query = {
    token: TOKEN,
    ...(options.query ?? {}),
  }
  ;(req as unknown as { body: unknown }).body = options.body

  const response = mockResponse()
  await handler(req, response.res)
  return response
}

function configOf(response: ReturnType<typeof mockResponse>): WebhookAuthConfig {
  return (response.jsonBody as { config: WebhookAuthConfig }).config
}

describe('smoke: configuring query param auth through the API', () => {
  test('a fresh token starts with both switches off', async () => {
    const response = await call(authHandler, { method: 'GET' })

    assert.equal(response.statusCode, 200)
    const config = configOf(response)
    assert.equal(config.enabled, false)
    assert.equal(config.queryEnabled, false)
    assert.deepEqual(config.queryParams, [])
  })

  test('PUT /auth stores a query param requirement', async () => {
    const response = await call(authHandler, {
      method: 'PUT',
      body: {
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: [{ name: 'callback_key', value: 'query-secret' }],
      },
    })

    assert.equal(response.statusCode, 200)
    const config = configOf(response)
    assert.equal(config.queryEnabled, true)
    assert.deepEqual(config.queryParams, [{ name: 'callback_key', value: 'query-secret' }])
    assert.ok(config.updatedAt)
  })

  test('GET /auth-query returns only the query half', async () => {
    const response = await call(authQueryHandler, {
      method: 'GET',
      url: `/api/webhook/${TOKEN}/auth-query`,
    })

    assert.equal(response.statusCode, 200)
    const config = response.jsonBody as { config: Record<string, unknown> }
    assert.deepEqual(Object.keys(config.config).sort(), ['queryEnabled', 'queryParams'])
  })

  test('PUT /auth-query merges without disturbing configured headers', async () => {
    await call(authHandler, {
      method: 'PUT',
      body: {
        enabled: true,
        headers: [{ name: 'X-Webhook-Key', value: 'header-secret' }],
        queryEnabled: true,
        queryParams: [{ name: 'callback_key', value: 'query-secret' }],
      },
    })

    const response = await call(authQueryHandler, {
      method: 'PUT',
      url: `/api/webhook/${TOKEN}/auth-query`,
      body: { queryEnabled: true, queryParams: [{ name: 'rotated_key', value: 'rotated-secret' }] },
    })

    assert.equal(response.statusCode, 200)
    const config = configOf(response)
    assert.equal(config.enabled, true)
    assert.deepEqual(config.headers, [{ name: 'X-Webhook-Key', value: 'header-secret' }])
    assert.deepEqual(config.queryParams, [{ name: 'rotated_key', value: 'rotated-secret' }])
  })

  test('DELETE /auth-query clears the query rule and keeps the header rule', async () => {
    const response = await call(authQueryHandler, {
      method: 'DELETE',
      url: `/api/webhook/${TOKEN}/auth-query`,
    })

    assert.equal(response.statusCode, 200)
    const config = configOf(response)
    assert.equal(config.queryEnabled, false)
    assert.deepEqual(config.queryParams, [])
    assert.equal(config.enabled, true)
  })

  test('an invalid query param is rejected with 400 and a usable message', async () => {
    const response = await call(authQueryHandler, {
      method: 'PUT',
      url: `/api/webhook/${TOKEN}/auth-query`,
      body: { queryEnabled: true, queryParams: [{ name: 'bad&name', value: 'x' }] },
    })

    assert.equal(response.statusCode, 400)
    assert.match((response.jsonBody as { error: string }).error, /not a valid query param name/i)
  })

  test('an unsupported method is refused with 405 and an Allow header', async () => {
    const response = await call(authQueryHandler, {
      method: 'POST',
      url: `/api/webhook/${TOKEN}/auth-query`,
      body: {},
    })

    assert.equal(response.statusCode, 405)
    assert.deepEqual(response.headers.allow, ['GET', 'PUT', 'DELETE', 'OPTIONS'])
  })

  test('an invalid token is refused with 400', async () => {
    const req = mockRequest({ method: 'GET', url: '/api/webhook/bad/auth-query' })
    ;(req as unknown as { query: Record<string, string> }).query = { token: '../../elsewhere' }
    const response = mockResponse()
    await authQueryHandler(req, response.res)

    assert.equal(response.statusCode, 400)
    assert.match((response.jsonBody as { error: string }).error, /Invalid webhook token/)
  })

  test('a CORS preflight is answered with 204', async () => {
    const response = await call(authQueryHandler, {
      method: 'OPTIONS',
      url: `/api/webhook/${TOKEN}/auth-query`,
    })

    assert.equal(response.statusCode, 204)
    assert.equal(response.headers['access-control-allow-origin'], '*')
  })
})

describe('smoke: the capture route enforces what was configured', () => {
  before(async () => {
    await call(authHandler, {
      method: 'PUT',
      body: {
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: [{ name: 'callback_key', value: 'query-secret' }],
      },
    })
  })

  async function sendCallback(url: string, headers: Record<string, string> = {}) {
    const req = mockRequest({ method: 'HEAD', url, headers })
    ;(req as unknown as { query: Record<string, string | string[]> }).query = {
      token: TOKEN,
      path: [],
    }
    const response = mockResponse()
    await captureHandler(req, response.res)
    return response
  }

  test('a callback carrying the right query param is accepted', async () => {
    const response = await sendCallback(captureUrl(TOKEN, [['callback_key', 'query-secret']]))
    assert.equal(response.statusCode, 200)
  })

  test('a callback without the query param is rejected with 401', async () => {
    const response = await sendCallback(`/api/hook/${TOKEN}`)

    assert.equal(response.statusCode, 401)
    const error = (response.jsonBody as { error: string }).error
    assert.match(error, /Unauthorized/)
    // The 401 must not say which credential failed, or it becomes an oracle.
    assert.ok(!error.includes('callback_key'))
    assert.ok(!error.includes('query-secret'))
  })

  test('a callback with a wrong value is rejected with 401', async () => {
    const response = await sendCallback(captureUrl(TOKEN, [['callback_key', 'guess']]))
    assert.equal(response.statusCode, 401)
  })

  test('every rejection is recorded as a blocked attempt with the value redacted', async () => {
    const response = await call(blockedHandler, {
      method: 'GET',
      url: `/api/webhook/${TOKEN}/blocked`,
    })

    assert.equal(response.statusCode, 200)
    const { blocked } = response.jsonBody as {
      blocked: Array<{ url: string; reason: string; missingQueryParams: string[] }>
    }

    assert.ok(blocked.length >= 2, `expected blocked attempts, got ${blocked.length}`)
    for (const record of blocked) {
      assert.ok(!record.url.includes('query-secret'), `secret leaked into ${record.url}`)
    }
    assert.ok(blocked.some((record) => record.reason === 'missing-query-param'))
    assert.ok(blocked.some((record) => record.reason === 'query-param-mismatch'))
  })

  test('turning the rule off reopens the inbox to every sender', async () => {
    await call(authQueryHandler, {
      method: 'DELETE',
      url: `/api/webhook/${TOKEN}/auth-query`,
    })

    const response = await sendCallback(`/api/hook/${TOKEN}`)
    assert.equal(response.statusCode, 200)
  })
})
