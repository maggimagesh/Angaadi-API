// Unit tests for checkWebhookAuth: the gate every inbound callback passes
// through before it is captured.
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import type { WebhookAuthConfig } from '@/types/webhook'
import { checkWebhookAuth, collectRequestQueryParams } from '@/utils/webhookAuth'
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
