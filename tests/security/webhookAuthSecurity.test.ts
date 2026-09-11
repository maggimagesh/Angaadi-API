// Security / vulnerability tests. Everything here feeds hostile input through
// the same path an inbound callback takes, and asserts that it is rejected,
// neutralised, or bounded — never that it merely "works".
import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'
import type { WebhookAuthConfig } from '@/types/webhook'
import {
  checkWebhookAuth,
  clearBlockedAttempts,
  getWebhookAuthConfig,
  listBlockedAttempts,
  recordBlockedAttempt,
  saveWebhookAuthConfig,
  validateAuthConfigInput,
} from '@/utils/webhookAuth'
import { captureUrl, mockRequest } from '../helpers/mockRequest.ts'

const TOKEN = 'securitytoken001'
let storageRoot: string

before(async () => {
  storageRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'webhook-auth-security-'))
  process.env.WEBHOOK_BODY_DIR = storageRoot
})

after(async () => {
  await fsp.rm(storageRoot, { recursive: true, force: true })
})

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

function rejects(body: unknown): string {
  const result = validateAuthConfigInput(body)
  assert.ok('error' in result, `expected rejection of ${JSON.stringify(body)}`)
  return result.error
}

function queryConfigBody(name: string, value = 'secret') {
  return { enabled: false, headers: [], queryEnabled: true, queryParams: [{ name, value }] }
}

describe('injection through param names', () => {
  test('rejects names carrying query-string separators', () => {
    // Any of these would let one configured entry masquerade as several, or
    // bleed into the path/fragment when the name is written into a URL.
    for (const name of [
      'name&admin=1',
      'name=second',
      'name?other',
      'name#frag',
      'name/../../elsewhere',
      'name%26admin',
      'name with space',
      'name\\slash',
      'name;drop',
      'name|pipe',
      'name<script>alert(1)</script>',
      'name"quoted"',
      "name'quoted'",
    ]) {
      assert.match(rejects(queryConfigBody(name)), /not a valid query param name/i)
    }
  })

  test('rejects names with CRLF, null bytes, or other control characters', () => {
    for (const name of [
      'key\r\nSet-Cookie: a=b',
      'key\u0000',
      'key\u0000.admin',
      'key\u001F',
      'key\u007F',
      'a\tb',
    ]) {
      assert.match(rejects(queryConfigBody(name)), /not a valid query param name/i)
    }
  })

  test('strips surrounding whitespace rather than storing a name that only looks clean', () => {
    // A trailing newline is trimmed away, so what gets stored is the plain name
    // — never a name that renders as "key" but matches something else.
    const result = validateAuthConfigInput(queryConfigBody('key\n', 'secret\r'))
    assert.ok('config' in result)
    assert.deepEqual(result.config.queryParams, [{ name: 'key', value: 'secret' }])
  })

  test('rejects values containing control characters', () => {
    for (const value of [
      'secret\r\nX-Injected: 1',
      'secret\u0000',
      'secret\u001F',
      'secret\u007F',
      'a\tb',
    ]) {
      assert.match(rejects(queryConfigBody('key', value)), /not allowed/i)
    }
  })

  test('rejects non-ASCII homoglyph names rather than silently normalising them', () => {
    // "kеy" carries a Cyrillic "e" that renders identically to "key".
    assert.match(rejects(queryConfigBody('kеy')), /not a valid query param name/i)
  })
})

describe('prototype pollution', () => {
  test('rejects __proto__, constructor and prototype as param names', () => {
    for (const name of ['__proto__', 'constructor', 'prototype', '__PROTO__', 'Constructor']) {
      assert.match(rejects(queryConfigBody(name)), /reserved query param/i)
    }
  })

  test('a hostile __proto__ in the request query never reaches Object.prototype', () => {
    const result = checkWebhookAuth(
      mockRequest({
        url: `/api/hook/${TOKEN}?__proto__[polluted]=yes&constructor[prototype][polluted]=yes&callback_key=secret`,
      }),
      config({ queryEnabled: true, queryParams: [{ name: 'callback_key', value: 'secret' }] })
    )

    assert.deepEqual(result, { ok: true })
    assert.equal(({} as Record<string, unknown>).polluted, undefined)
    assert.equal((Object.prototype as unknown as Record<string, unknown>).polluted, undefined)
  })

  test('a stored config carrying __proto__ does not pollute when loaded', () => {
    const hostile = JSON.parse(
      '{"enabled":false,"headers":[],"queryEnabled":true,"queryParams":[{"name":"k","value":"v"}],"__proto__":{"polluted":"yes"}}'
    ) as WebhookAuthConfig

    checkWebhookAuth(mockRequest({ url: captureUrl(TOKEN, [['k', 'v']]) }), hostile)

    assert.equal(({} as Record<string, unknown>).polluted, undefined)
  })
})

describe('route parameter shadowing', () => {
  test('rejects "token" and "path" as param names', () => {
    for (const name of ['token', 'path', 'TOKEN', 'Path']) {
      assert.match(rejects(queryConfigBody(name)), /reserved query param/i)
    }
  })

  test('a param is read from the URL, never from Next.js routing data', () => {
    // req.query on the capture route carries the inbox token and path segments.
    // The check reads the wire query string instead, so routing data can never
    // satisfy a requirement on its own.
    const req = mockRequest({ url: `/api/hook/${TOKEN}` })
    ;(req as unknown as { query: Record<string, string> }).query = { sneaky: 'sneaky-secret' }

    const result = checkWebhookAuth(
      req,
      config({ queryEnabled: true, queryParams: [{ name: 'sneaky', value: 'sneaky-secret' }] })
    )

    assert.equal(result.ok, false)
  })
})

describe('HTTP parameter pollution', () => {
  const pollutionConfig = config({
    queryEnabled: true,
    queryParams: [{ name: 'callback_key', value: 'secret' }],
  })

  test('a required param sent twice is rejected even when one copy is correct', () => {
    for (const url of [
      `/api/hook/${TOKEN}?callback_key=secret&callback_key=wrong`,
      `/api/hook/${TOKEN}?callback_key=wrong&callback_key=secret`,
      `/api/hook/${TOKEN}?callback_key=secret&callback_key=secret`,
    ]) {
      const result = checkWebhookAuth(mockRequest({ url }), pollutionConfig)
      assert.equal(result.ok, false, `expected ${url} to be rejected`)
      assert.ok(result.ok === false)
      assert.deepEqual(result.mismatchedQueryParams, ['callback_key'])
    }
  })

  test('an array-suffixed copy does not satisfy the requirement', () => {
    const result = checkWebhookAuth(
      mockRequest({ url: `/api/hook/${TOKEN}?callback_key[]=secret` }),
      pollutionConfig
    )
    assert.equal(result.ok, false)
  })
})

describe('secrets are never echoed back', () => {
  test('the blocked-attempt log redacts every configured auth param value', () => {
    clearBlockedAttempts(TOKEN)

    const authConfig = config({
      enabled: true,
      headers: [{ name: 'X-Webhook-Key', value: 'header-secret' }],
      queryEnabled: true,
      queryParams: [
        { name: 'callback_key', value: 'query-secret' },
        { name: 'second_key', value: 'second-secret' },
      ],
    })

    // The caller gets the query secrets right but the header wrong, so without
    // redaction the correct secrets would land in the log verbatim.
    const req = mockRequest({
      url: captureUrl(TOKEN, [
        ['event', 'order.created'],
        ['callback_key', 'query-secret'],
        ['second_key', 'second-secret'],
      ]),
      headers: { 'x-webhook-key': 'wrong' },
    })

    const failure = checkWebhookAuth(req, authConfig)
    assert.ok(failure.ok === false)

    const record = recordBlockedAttempt(req, TOKEN, [], failure, authConfig)

    assert.ok(!record.url.includes('query-secret'), `secret leaked into ${record.url}`)
    assert.ok(!record.url.includes('second-secret'), `secret leaked into ${record.url}`)
    assert.match(record.url, /callback_key=\*\*\*/)
    assert.match(record.url, /second_key=\*\*\*/)
    // Non-secret params stay readable so the log is still useful.
    assert.match(record.url, /event=order\.created/)
    // Names are reported, values never are.
    assert.deepEqual(record.mismatchedHeaders, ['X-Webhook-Key'])
    assert.ok(!JSON.stringify(record).includes('header-secret'))

    clearBlockedAttempts(TOKEN)
  })

  test('a percent-encoded secret name is still redacted', () => {
    clearBlockedAttempts(TOKEN)

    // Two params are required; the caller percent-encodes the one it got right
    // and omits the other, so the correct secret is present on a failed request.
    const authConfig = config({
      queryEnabled: true,
      queryParams: [
        { name: 'callback.key', value: 'query-secret' },
        { name: 'other_key', value: 'other-secret' },
      ],
    })
    const req = mockRequest({ url: `/api/hook/${TOKEN}?callback%2Ekey=query-secret&x=1` })
    const failure = checkWebhookAuth(req, authConfig)
    assert.ok(failure.ok === false)
    assert.deepEqual(failure.missingQueryParams, ['other_key'])

    const record = recordBlockedAttempt(req, TOKEN, [], failure, authConfig)
    assert.ok(!record.url.includes('query-secret'), `secret leaked into ${record.url}`)
    assert.match(record.url, /callback%2Ekey=\*\*\*/)

    clearBlockedAttempts(TOKEN)
  })

  test('control characters in the request line are stripped before logging', () => {
    clearBlockedAttempts(TOKEN)

    const authConfig = config({ queryEnabled: true, queryParams: [{ name: 'k', value: 'v' }] })
    const req = mockRequest({
      url: `/api/hook/${TOKEN}?evil=a\r\nFAKE-LOG-LINE: injected\u0000b`,
    })
    const failure = checkWebhookAuth(req, authConfig)
    assert.ok(failure.ok === false)

    const record = recordBlockedAttempt(req, TOKEN, [], failure, authConfig)

    assert.ok(
      !/[\u0000-\u001F\u007F]/.test(record.url),
      'control characters survived into the log'
    )

    clearBlockedAttempts(TOKEN)
  })

  test('a very long request line is truncated in the log', () => {
    clearBlockedAttempts(TOKEN)

    const authConfig = config({ queryEnabled: true, queryParams: [{ name: 'k', value: 'v' }] })
    const req = mockRequest({ url: `/api/hook/${TOKEN}?padding=${'A'.repeat(100_000)}` })
    const failure = checkWebhookAuth(req, authConfig)
    assert.ok(failure.ok === false)

    const record = recordBlockedAttempt(req, TOKEN, [], failure, authConfig)

    assert.ok(record.url.length <= 2049, `logged URL was ${record.url.length} characters`)

    clearBlockedAttempts(TOKEN)
  })

  test('the failure result names what failed but carries no value', () => {
    const authConfig = config({
      queryEnabled: true,
      queryParams: [{ name: 'callback_key', value: 'query-secret' }],
    })
    const failure = checkWebhookAuth(
      mockRequest({ url: captureUrl(TOKEN, [['callback_key', 'guess']]) }),
      authConfig
    )

    assert.ok(failure.ok === false)
    const serialised = JSON.stringify(failure)
    assert.ok(!serialised.includes('query-secret'))
    assert.ok(!serialised.includes('guess'))
  })
})

describe('resource limits', () => {
  test('the blocked-attempt log is bounded per token', () => {
    clearBlockedAttempts(TOKEN)

    const authConfig = config({ queryEnabled: true, queryParams: [{ name: 'k', value: 'v' }] })

    for (let index = 0; index < 250; index += 1) {
      const req = mockRequest({ url: `/api/hook/${TOKEN}?attempt=${index}` })
      const failure = checkWebhookAuth(req, authConfig)
      assert.ok(failure.ok === false)
      recordBlockedAttempt(req, TOKEN, [], failure, authConfig)
    }

    const logged = listBlockedAttempts(TOKEN)
    assert.ok(logged.length <= 100, `log grew to ${logged.length} records`)
    // Newest first, so a flood cannot push the most recent attempt out.
    assert.match(logged[0].url, /attempt=249/)

    clearBlockedAttempts(TOKEN)
  })

  test('a flood of unrelated query params neither matches nor stalls the check', () => {
    const noise = Array.from({ length: 2000 }, (_unused, index) => `n${index}=v${index}`).join('&')
    const started = Date.now()
    const result = checkWebhookAuth(
      mockRequest({ url: `/api/hook/${TOKEN}?${noise}` }),
      config({ queryEnabled: true, queryParams: [{ name: 'callback_key', value: 'secret' }] })
    )

    assert.equal(result.ok, false)
    assert.ok(Date.now() - started < 1000, 'parsing a large query string took too long')
  })

  test('an oversized param list is rejected at config time', () => {
    const tooMany = Array.from({ length: 500 }, (_unused, index) => ({
      name: `key${index}`,
      value: 'secret',
    }))
    assert.match(
      rejects({ enabled: false, headers: [], queryEnabled: true, queryParams: tooMany }),
      /maximum of 10/i
    )
  })

  test('a pathological name is rejected quickly rather than backtracked over', () => {
    const started = Date.now()
    rejects(queryConfigBody(`${'a'.repeat(50_000)}!`))
    assert.ok(Date.now() - started < 1000, 'name validation took too long')
  })
})

describe('comparison safety', () => {
  test('a near-miss value of a very different length is still rejected', () => {
    const secret = 'x'.repeat(512)
    const authConfig = config({
      queryEnabled: true,
      queryParams: [{ name: 'k', value: secret }],
    })

    assert.equal(
      checkWebhookAuth(mockRequest({ url: captureUrl(TOKEN, [['k', 'x']]) }), authConfig).ok,
      false
    )
    assert.equal(
      checkWebhookAuth(mockRequest({ url: captureUrl(TOKEN, [['k', `${secret}y`]]) }), authConfig)
        .ok,
      false
    )
    assert.deepEqual(
      checkWebhookAuth(mockRequest({ url: captureUrl(TOKEN, [['k', secret]]) }), authConfig),
      { ok: true }
    )
  })

  test('constant-time comparison does not leak position through timing', () => {
    const secret = 'a'.repeat(64)
    const authConfig = config({ queryEnabled: true, queryParams: [{ name: 'k', value: secret }] })

    const timeFor = (candidate: string): number => {
      const req = mockRequest({ url: captureUrl(TOKEN, [['k', candidate]]) })
      const started = process.hrtime.bigint()
      for (let index = 0; index < 2000; index += 1) {
        checkWebhookAuth(req, authConfig)
      }
      return Number(process.hrtime.bigint() - started)
    }

    // Warm up so JIT effects do not dominate the measurement.
    timeFor(secret)

    const wrongFirstChar = timeFor(`b${secret.slice(1)}`)
    const wrongLastChar = timeFor(`${secret.slice(0, -1)}b`)
    const ratio = Math.max(wrongFirstChar, wrongLastChar) / Math.min(wrongFirstChar, wrongLastChar)

    // A naive === would return almost immediately on a first-character
    // mismatch. Hashing both sides first keeps the two within noise of each
    // other; the bound is loose because this runs on a shared machine.
    assert.ok(ratio < 3, `timing ratio ${ratio.toFixed(2)} suggests an early-exit comparison`)
  })
})

describe('stored config sanitisation', () => {
  test('a hand-edited config file with junk entries loads safely', async () => {
    const junkToken = 'junkconfigtoken1'
    const authDir = path.join(storageRoot, '_auth')
    await fsp.mkdir(authDir, { recursive: true })
    await fsp.writeFile(
      path.join(authDir, `${junkToken}.json`),
      JSON.stringify({
        enabled: true,
        headers: 'not-an-array',
        queryEnabled: true,
        queryParams: [
          { name: 'good', value: 'secret' },
          { name: 42, value: 'secret' },
          null,
          'string-entry',
          { name: 'nameonly' },
        ],
      }),
      'utf8'
    )

    const loaded = await getWebhookAuthConfig(junkToken)

    // Junk entries are dropped rather than crashing the request path, and a
    // switch left with nothing valid behind it falls back to off.
    assert.equal(loaded.enabled, false)
    assert.deepEqual(loaded.headers, [])
    assert.deepEqual(loaded.queryParams, [{ name: 'good', value: 'secret' }])
    assert.equal(loaded.queryEnabled, true)
  })

  test('an invalid token is refused before any filesystem access', async () => {
    for (const badToken of ['../../elsewhere', 'short', 'has space', 'a/b', '']) {
      await assert.rejects(
        () =>
          saveWebhookAuthConfig(badToken, {
            enabled: false,
            headers: [],
            queryEnabled: false,
            queryParams: [],
          }),
        /Invalid webhook token/
      )
    }
  })
})
