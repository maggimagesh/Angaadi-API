// Unit tests for checkWebhookAuth: the gate every inbound callback passes
// through before it is captured.
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import type { WebhookAuthConfig } from '@/types/webhook'
import {
  appendWebhookQueryAuthParams,
  buildAuthorizedCaptureUrl,
  checkWebhookAuth,
  collectRequestQueryParams,
} from '@/utils/webhookAuth'
import { captureUrl, mockRequest } from '../helpers/mockRequest.ts'

const TOKEN = 'abcdefghijkl'

function config(overrides: Partial<WebhookAuthConfig> = {}): WebhookAuthConfig {
  return {
    enabled: false,
    headers: [],
    queryEnabled: false,
    queryParams: [],
    updatedAt: null,
    ...overrides,
  }
}

function assertBlocked(result: ReturnType<typeof checkWebhookAuth>) {
  assert.equal(result.ok, false)
  assert.ok(result.ok === false)
  return result
}

describe('collectRequestQueryParams', () => {
  test('reads params off the raw URL', () => {
    const params = collectRequestQueryParams(
      mockRequest({ url: captureUrl(TOKEN, [['key', 'secret']]) })
    )
    assert.deepEqual(params.get('key'), ['secret'])
  })

  test('returns an empty map when there is no query string', () => {
    assert.equal(collectRequestQueryParams(mockRequest({ url: `/api/hook/${TOKEN}` })).size, 0)
  })

  test('percent-decodes names and values', () => {
    const params = collectRequestQueryParams(
      mockRequest({ url: `/api/hook/${TOKEN}?call%20back=a%26b%3Dc` })
    )
    assert.deepEqual(params.get('call back'), ['a&b=c'])
  })

  test('keeps every occurrence of a repeated param', () => {
    const params = collectRequestQueryParams(
      mockRequest({ url: `/api/hook/${TOKEN}?key=first&key=second` })
    )
    assert.deepEqual(params.get('key'), ['first', 'second'])
  })

  test('ignores a fragment appended to the request line', () => {
    const params = collectRequestQueryParams(
      mockRequest({ url: `/api/hook/${TOKEN}?key=secret#key=other` })
    )
    assert.deepEqual(params.get('key'), ['secret'])
  })
})

describe('checkWebhookAuth — nothing required', () => {
  test('accepts any request when both switches are off', () => {
    assert.deepEqual(checkWebhookAuth(mockRequest(), config()), { ok: true })
  })

  test('accepts any request when a switch is on but its list is empty', () => {
    assert.deepEqual(
      checkWebhookAuth(mockRequest(), config({ enabled: true, queryEnabled: true })),
      { ok: true }
    )
  })
})

describe('checkWebhookAuth — query params only', () => {
  const queryOnly = config({
    queryEnabled: true,
    queryParams: [{ name: 'callback_key', value: 'secret-123' }],
  })

  test('accepts a request carrying the exact param', () => {
    const result = checkWebhookAuth(
      mockRequest({ url: captureUrl(TOKEN, [['callback_key', 'secret-123']]) }),
      queryOnly
    )
    assert.deepEqual(result, { ok: true })
  })

  test('accepts a param whose value needs percent-encoding', () => {
    const secret = 'a b&c=d+e/f?g#h'
    const result = checkWebhookAuth(
      mockRequest({ url: captureUrl(TOKEN, [['callback_key', secret]]) }),
      config({ queryEnabled: true, queryParams: [{ name: 'callback_key', value: secret }] })
    )
    assert.deepEqual(result, { ok: true })
  })

  test('accepts the param alongside unrelated query params', () => {
    const result = checkWebhookAuth(
      mockRequest({
        url: captureUrl(TOKEN, [
          ['event', 'order.created'],
          ['callback_key', 'secret-123'],
          ['retry', '2'],
        ]),
      }),
      queryOnly
    )
    assert.deepEqual(result, { ok: true })
  })

  test('rejects a request with no query string at all', () => {
    const result = assertBlocked(
      checkWebhookAuth(mockRequest({ url: `/api/hook/${TOKEN}` }), queryOnly)
    )
    assert.deepEqual(result.missingQueryParams, ['callback_key'])
    assert.deepEqual(result.mismatchedQueryParams, [])
  })

  test('rejects a wrong value', () => {
    const result = assertBlocked(
      checkWebhookAuth(
        mockRequest({ url: captureUrl(TOKEN, [['callback_key', 'wrong']]) }),
        queryOnly
      )
    )
    assert.deepEqual(result.mismatchedQueryParams, ['callback_key'])
    assert.deepEqual(result.missingQueryParams, [])
  })

  test('rejects a name that differs only in case', () => {
    const result = assertBlocked(
      checkWebhookAuth(
        mockRequest({ url: captureUrl(TOKEN, [['Callback_Key', 'secret-123']]) }),
        queryOnly
      )
    )
    assert.deepEqual(result.missingQueryParams, ['callback_key'])
  })

  test('rejects an empty value', () => {
    const result = assertBlocked(
      checkWebhookAuth(mockRequest({ url: `/api/hook/${TOKEN}?callback_key=` }), queryOnly)
    )
    assert.deepEqual(result.mismatchedQueryParams, ['callback_key'])
  })

  test('rejects a valueless flag form', () => {
    const result = assertBlocked(
      checkWebhookAuth(mockRequest({ url: `/api/hook/${TOKEN}?callback_key` }), queryOnly)
    )
    assert.deepEqual(result.mismatchedQueryParams, ['callback_key'])
  })

  test('reports every failing param, not just the first', () => {
    const result = assertBlocked(
      checkWebhookAuth(
        mockRequest({ url: captureUrl(TOKEN, [['b', 'wrong']]) }),
        config({
          queryEnabled: true,
          queryParams: [
            { name: 'a', value: 'one' },
            { name: 'b', value: 'two' },
            { name: 'c', value: 'three' },
          ],
        })
      )
    )
    assert.deepEqual(result.missingQueryParams, ['a', 'c'])
    assert.deepEqual(result.mismatchedQueryParams, ['b'])
  })
})

describe('checkWebhookAuth — headers and query params together', () => {
  const both = config({
    enabled: true,
    headers: [{ name: 'X-Webhook-Key', value: 'header-secret' }],
    queryEnabled: true,
    queryParams: [{ name: 'callback_key', value: 'query-secret' }],
  })

  test('accepts only when both are satisfied', () => {
    const result = checkWebhookAuth(
      mockRequest({
        url: captureUrl(TOKEN, [['callback_key', 'query-secret']]),
        headers: { 'x-webhook-key': 'header-secret' },
      }),
      both
    )
    assert.deepEqual(result, { ok: true })
  })

  test('rejects a correct header with a missing query param', () => {
    const result = assertBlocked(
      checkWebhookAuth(
        mockRequest({ url: `/api/hook/${TOKEN}`, headers: { 'x-webhook-key': 'header-secret' } }),
        both
      )
    )
    assert.deepEqual(result.missingHeaders, [])
    assert.deepEqual(result.missingQueryParams, ['callback_key'])
  })

  test('rejects a correct query param with a missing header', () => {
    const result = assertBlocked(
      checkWebhookAuth(
        mockRequest({ url: captureUrl(TOKEN, [['callback_key', 'query-secret']]) }),
        both
      )
    )
    assert.deepEqual(result.missingHeaders, ['X-Webhook-Key'])
    assert.deepEqual(result.missingQueryParams, [])
  })

  test('reports failures from both halves at once', () => {
    const result = assertBlocked(
      checkWebhookAuth(
        mockRequest({
          url: captureUrl(TOKEN, [['callback_key', 'nope']]),
          headers: { 'x-webhook-key': 'nope' },
        }),
        both
      )
    )
    assert.deepEqual(result.mismatchedHeaders, ['X-Webhook-Key'])
    assert.deepEqual(result.mismatchedQueryParams, ['callback_key'])
  })

  test('ignores the query half when only headers are switched on', () => {
    const result = checkWebhookAuth(
      mockRequest({ headers: { 'x-webhook-key': 'header-secret' } }),
      config({
        enabled: true,
        headers: [{ name: 'X-Webhook-Key', value: 'header-secret' }],
        queryEnabled: false,
        queryParams: [{ name: 'callback_key', value: 'query-secret' }],
      })
    )
    assert.deepEqual(result, { ok: true })
  })

  test('ignores the header half when only query params are switched on', () => {
    const result = checkWebhookAuth(
      mockRequest({ url: captureUrl(TOKEN, [['callback_key', 'query-secret']]) }),
      config({
        enabled: false,
        headers: [{ name: 'X-Webhook-Key', value: 'header-secret' }],
        queryEnabled: true,
        queryParams: [{ name: 'callback_key', value: 'query-secret' }],
      })
    )
    assert.deepEqual(result, { ok: true })
  })
})

describe('appendWebhookQueryAuthParams', () => {
  const BASE = `https://hooks.example.com/valid-webhooks/${TOKEN}`

  test('returns the base URL untouched when nothing is configured', () => {
    assert.equal(appendWebhookQueryAuthParams(BASE, []), BASE)
  })

  test('appends one param', () => {
    assert.equal(
      appendWebhookQueryAuthParams(BASE, [{ name: 'callback_key', value: 'secret' }]),
      `${BASE}?callback_key=secret`
    )
  })

  test('joins several params with &', () => {
    assert.equal(
      appendWebhookQueryAuthParams(BASE, [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ]),
      `${BASE}?a=1&b=2`
    )
  })

  test('uses & when the base URL already carries a query string', () => {
    assert.equal(
      appendWebhookQueryAuthParams(`${BASE}?existing=1`, [{ name: 'k', value: 'v' }]),
      `${BASE}?existing=1&k=v`
    )
  })

  test('percent-encodes a value so the URL is usable as-is', () => {
    const secret = 'a b&c=d?e#f'
    const url = appendWebhookQueryAuthParams(BASE, [{ name: 'k', value: secret }])
    const parsed = new URL(url)

    assert.equal(parsed.searchParams.get('k'), secret)
    // A value that looks like extra params cannot become them.
    assert.deepEqual([...parsed.searchParams.keys()], ['k'])
    assert.equal(parsed.hash, '')
  })

  test('the URL it produces actually passes the check it describes', () => {
    // The whole point: whatever this hands out must satisfy checkWebhookAuth.
    const queryParams = [
      { name: 'callback_key', value: 'a b&c=d' },
      { name: 'tenant.id', value: 'acme~1' },
    ]
    const url = appendWebhookQueryAuthParams(`/api/hook/${TOKEN}`, queryParams)

    assert.deepEqual(
      checkWebhookAuth(mockRequest({ url }), config({ queryEnabled: true, queryParams })),
      { ok: true }
    )
  })
})

describe('buildAuthorizedCaptureUrl', () => {
  const BASE = `https://hooks.example.com/valid-webhooks/${TOKEN}`

  test('appends the params when the requirement is on', () => {
    const url = buildAuthorizedCaptureUrl(
      BASE,
      config({ queryEnabled: true, queryParams: [{ name: 'k', value: 'v' }] })
    )
    assert.equal(url, `${BASE}?k=v`)
  })

  test('omits them while the requirement is off', () => {
    // Handing out a URL carrying secrets that nothing checks would be
    // misleading, so an off switch means a bare URL.
    const url = buildAuthorizedCaptureUrl(
      BASE,
      config({ queryEnabled: false, queryParams: [{ name: 'k', value: 'v' }] })
    )
    assert.equal(url, BASE)
  })
})
