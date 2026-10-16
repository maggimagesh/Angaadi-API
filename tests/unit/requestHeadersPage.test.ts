// Tests for the server-rendered /request-headers page.
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import type { NextApiRequest } from 'next'
import { buildRequestHeadersReport } from '@/utils/requestHeaders'
import { escapeHtml, escapeJsonForScript, renderRequestHeadersPage } from '@/utils/requestHeadersPage'
import handler, { resolvePageUrl } from '../../pages/api/request-headers-page.ts'
import { mockRequest } from '../helpers/mockRequest.ts'
import { mockResponse } from '../helpers/mockResponse.ts'

const OPTIONS = {
  pageUrl: 'https://api.angaadi.dev/request-headers',
  jsonUrl: '/api/v1/request-headers',
  siteUrl: 'https://angaadi.dev',
  nonce: 'abc123',
}

function render(headers: Record<string, string>) {
  return renderRequestHeadersPage(
    buildRequestHeadersReport({ method: 'GET', url: '/request-headers', headers }, new Date('2026-10-16T00:00:00Z')),
    OPTIONS
  )
}

describe('renderRequestHeadersPage', () => {
  test('writes every header into the table on the server', () => {
    const html = render({ host: 'api.angaadi.dev', 'user-agent': 'Probe/1', accept: 'text/html' })
    assert.match(html, /<th scope="col">HTTP header<\/th><th scope="col">Value<\/th>/)
    assert.match(html, /<tr data-header="user-agent" data-origin="client"><th scope="row">user-agent<\/th><td><code>Probe\/1<\/code><\/td><\/tr>/)
    assert.match(html, /data-testid="request-headers-count">3</)
  })

  test('escapes attacker-controlled header values everywhere', () => {
    const evil = '"><script>alert(1)</script>'
    const html = render({ 'user-agent': evil, referer: `https://x.test/${evil}` })
    assert.equal(html.includes('<script>alert(1)</script>'), false)
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
    // The embedded JSON cannot close its <script> element either.
    assert.equal(/<\/script>alert/.test(html), false)
  })

  test('hides credential headers behind a reveal and flags proxy headers', () => {
    const html = render({ authorization: 'Bearer secret', 'x-vercel-id': 'bom1::x' })
    assert.match(html, /<details class="secret"><summary>Hidden &mdash; click to reveal<\/summary><code>Bearer secret<\/code><\/details>/)
    assert.match(html, /data-header="x-vercel-id" data-origin="proxy"><th scope="row">x-vercel-id <span class="badge"/)
  })

  test('carries the manytools features: breadcrumb, share, link snippet, updates', () => {
    const html = render({ host: 'api.angaadi.dev' })
    for (const id of ['breadcrumb', 'share-panel', 'share-counter', 'share-x', 'share-facebook', 'link-snippet', 'contact-panel', 'updates-panel']) {
      assert.ok(html.includes(`data-testid="${id}"`), `missing ${id}`)
    }
    assert.ok(html.includes('&lt;a href=&quot;https://api.angaadi.dev/request-headers&quot;&gt;'))
  })

  test('both inline blocks carry the CSP nonce', () => {
    const html = render({})
    assert.equal(html.match(/<script nonce="abc123">/g)?.length, 2)
    assert.equal(html.match(/<style nonce="abc123">/g)?.length, 1)
  })
})

describe('escaping helpers', () => {
  test('escapeHtml covers all five characters', () => {
    assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  })

  test('escapeJsonForScript stays valid JSON', () => {
    const value = { v: '</script><!-- & \u2028' }
    const out = escapeJsonForScript(value)
    assert.equal(out.includes('<'), false)
    assert.deepEqual(JSON.parse(out), value)
  })
})

describe('resolvePageUrl', () => {
  test('builds an absolute URL from a well-formed host', () => {
    assert.equal(resolvePageUrl({ headers: { host: 'api.angaadi.dev' } }, 'https'), 'https://api.angaadi.dev/request-headers')
    assert.equal(resolvePageUrl({ headers: { host: 'localhost:3300' } }, 'http'), 'http://localhost:3300/request-headers')
  })

  test('falls back to a relative URL for a malformed host', () => {
    assert.equal(resolvePageUrl({ headers: { host: 'evil.test/"><x' } }, 'https'), '/request-headers')
  })
})

describe('GET /request-headers', () => {
  const call = async (method: string, headers: Record<string, string> = {}) => {
    const req = mockRequest({ method, url: '/request-headers', headers })
    const out = mockResponse()
    await handler(req as NextApiRequest, out.res)
    return out
  }

  test('returns an uncached HTML page with a nonce-based CSP', async () => {
    const out = await call('GET', { host: 'api.angaadi.dev', 'user-agent': 'Probe/2' })
    assert.equal(out.statusCode, 200)
    assert.equal(out.headers['content-type'], 'text/html; charset=utf-8')
    assert.equal(out.headers['cache-control'], 'no-store, max-age=0')
    const csp = String(out.headers['content-security-policy'])
    const nonce = csp.match(/script-src 'nonce-([^']+)'/)?.[1]
    assert.ok(nonce)
    assert.ok(String(out.jsonBody).includes(`<script nonce="${nonce}">`))
    assert.ok(String(out.jsonBody).includes('Probe/2'))
  })

  test('HEAD sends headers only', async () => {
    const out = await call('HEAD')
    assert.equal(out.statusCode, 200)
    assert.equal(out.jsonBody, undefined)
  })

  test('rejects other methods with 405', async () => {
    const out = await call('POST')
    assert.equal(out.statusCode, 405)
  })
})

test('hidden buttons stay hidden despite the .btn display rule', () => {
  const html = renderRequestHeadersPage(buildRequestHeadersReport({ headers: {} }), OPTIONS)
  assert.ok(html.includes('.btn[hidden]{display:none}'))
})
