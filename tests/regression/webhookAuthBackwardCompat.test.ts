// Regression tests: every behaviour that existed before query-param auth was
// added has to keep working exactly as it did, including configs already
// written to disk by the previous version.
import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'
import type { WebhookAuthConfig } from '@/types/webhook'
import {
  checkWebhookAuth,
  clearWebhookAuthConfig,
  clearWebhookAuthQueryConfig,
  getWebhookAuthConfig,
  saveWebhookAuthConfig,
  saveWebhookAuthQueryConfig,
  validateAuthConfigInput,
} from '@/utils/webhookAuth'
import { captureUrl, mockRequest } from '../helpers/mockRequest.ts'

const TOKEN = 'regressiontoken01'
let storageRoot: string

before(async () => {
  storageRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'webhook-auth-regression-'))
  process.env.WEBHOOK_BODY_DIR = storageRoot
})

after(async () => {
  await fsp.rm(storageRoot, { recursive: true, force: true })
})

function expectConfig<T>(result: T | { error: string }): Exclude<T, { error: string }> {
  assert.ok(
    result && typeof result === 'object' && 'config' in result,
    `expected a valid config, got ${JSON.stringify(result)}`
  )
  return result as Exclude<T, { error: string }>
}

describe('header-only request bodies still validate', () => {
  test('a body with only enabled + headers is accepted and defaults query auth off', () => {
    const result = expectConfig(
      validateAuthConfigInput({
        enabled: true,
        headers: [{ name: 'x-api-key', value: 'secret123' }],
      })
    )

    assert.equal(result.config.enabled, true)
    assert.deepEqual(result.config.headers, [{ name: 'x-api-key', value: 'secret123' }])
    assert.equal(result.config.queryEnabled, false)
    assert.deepEqual(result.config.queryParams, [])
  })

  test('the original header validation errors are unchanged', () => {
    const cases: Array<[unknown, RegExp]> = [
      [{ enabled: true }, /"headers" must be an array/],
      [{ enabled: true, headers: [{ name: 'host', value: 'x' }] }, /reserved HTTP header/],
      [{ enabled: true, headers: [{ name: 'bad header', value: 'x' }] }, /not a valid HTTP header name/],
      [{ enabled: true, headers: [] }, /at least one header/],
      [
        {
          enabled: true,
          headers: [
            { name: 'x-key', value: 'a' },
            { name: 'X-KEY', value: 'b' },
          ],
        },
        /listed more than once/,
      ],
    ]

    for (const [body, pattern] of cases) {
      const result = validateAuthConfigInput(body)
      assert.ok('error' in result, `expected ${JSON.stringify(body)} to be rejected`)
      assert.match(result.error, pattern)
    }
  })
})

describe('configs stored by the previous version keep working', () => {
  test('a stored config with no query keys loads as query auth off', async () => {
    const legacyToken = 'legacytokenaaaa'
    const authDir = path.join(storageRoot, '_auth')
    await fsp.mkdir(authDir, { recursive: true })
    await fsp.writeFile(
      path.join(authDir, `${legacyToken}.json`),
      JSON.stringify({
        enabled: true,
        headers: [{ name: 'x-api-key', value: 'legacy-secret' }],
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      'utf8'
    )

    const config = await getWebhookAuthConfig(legacyToken)

    assert.equal(config.enabled, true)
    assert.deepEqual(config.headers, [{ name: 'x-api-key', value: 'legacy-secret' }])
    assert.equal(config.queryEnabled, false)
    assert.deepEqual(config.queryParams, [])

    // And the header rule it describes is still enforced the same way.
    assert.deepEqual(
      checkWebhookAuth(mockRequest({ headers: { 'x-api-key': 'legacy-secret' } }), config),
      { ok: true }
    )
    assert.equal(checkWebhookAuth(mockRequest(), config).ok, false)
  })
})

describe('the two halves are saved independently', () => {
  test('saving query params leaves configured headers in place', async () => {
    await saveWebhookAuthConfig(TOKEN, {
      enabled: true,
      headers: [{ name: 'x-api-key', value: 'header-secret' }],
      queryEnabled: false,
      queryParams: [],
    })

    const merged = await saveWebhookAuthQueryConfig(TOKEN, {
      queryEnabled: true,
      queryParams: [{ name: 'callback_key', value: 'query-secret' }],
    })

    assert.equal(merged.enabled, true)
    assert.deepEqual(merged.headers, [{ name: 'x-api-key', value: 'header-secret' }])
    assert.equal(merged.queryEnabled, true)
    assert.deepEqual(merged.queryParams, [{ name: 'callback_key', value: 'query-secret' }])
  })

  test('clearing query params leaves configured headers in place', async () => {
    const cleared = await clearWebhookAuthQueryConfig(TOKEN)

    assert.equal(cleared.enabled, true)
    assert.deepEqual(cleared.headers, [{ name: 'x-api-key', value: 'header-secret' }])
    assert.equal(cleared.queryEnabled, false)
    assert.deepEqual(cleared.queryParams, [])
  })

  test('clearing the whole config removes both halves', async () => {
    await saveWebhookAuthConfig(TOKEN, {
      enabled: true,
      headers: [{ name: 'x-api-key', value: 'header-secret' }],
      queryEnabled: true,
      queryParams: [{ name: 'callback_key', value: 'query-secret' }],
    })

    const cleared = await clearWebhookAuthConfig(TOKEN)

    assert.equal(cleared.enabled, false)
    assert.deepEqual(cleared.headers, [])
    assert.equal(cleared.queryEnabled, false)
    assert.deepEqual(cleared.queryParams, [])
    assert.deepEqual(checkWebhookAuth(mockRequest(), cleared), { ok: true })
  })

  test('a switch turned on with an empty list is stored as off', async () => {
    const saved = await saveWebhookAuthConfig(TOKEN, {
      enabled: true,
      headers: [],
      queryEnabled: true,
      queryParams: [],
    })

    assert.equal(saved.enabled, false)
    assert.equal(saved.queryEnabled, false)
  })

  test('a saved config round-trips through disk unchanged', async () => {
    const roundTripToken = 'roundtriptoken1'
    const saved = await saveWebhookAuthConfig(roundTripToken, {
      enabled: true,
      headers: [{ name: 'x-api-key', value: 'header-secret' }],
      queryEnabled: true,
      queryParams: [{ name: 'callback_key', value: 'query-secret' }],
    })

    const onDisk = JSON.parse(
      await fsp.readFile(path.join(storageRoot, '_auth', `${roundTripToken}.json`), 'utf8')
    ) as WebhookAuthConfig

    assert.deepEqual(onDisk, saved)
    assert.deepEqual(
      checkWebhookAuth(
        mockRequest({
          url: captureUrl(roundTripToken, [['callback_key', 'query-secret']]),
          headers: { 'x-api-key': 'header-secret' },
        }),
        onDisk
      ),
      { ok: true }
    )
  })
})
