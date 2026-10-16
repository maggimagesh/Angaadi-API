// Tests for the plain-HTML /request-headers page.
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import type { NextApiRequest } from 'next'
import { buildRequestHeadersReport } from '@/utils/requestHeaders'
import { escapeHtml, renderRequestHeadersPage } from '@/utils/requestHeadersPage'
import handler from '../../pages/api/request-headers-page.ts'
import { mockRequest } from '../helpers/mockRequest.ts'
import { mockResponse } from '../helpers/mockResponse.ts'

function render(rawHeaders: string[]) {
  return renderRequestHeadersPage(buildRequestHeadersReport({ headers: {}, rawHeaders }))
}

describe('renderRequestHeadersPage', () => {
  test('is one plain table of the headers, in order, with no script', () => {
    const html = render(['Host', 'api.angaadi.dev', 'User-Agent', 'Probe/1', 'Accept', 'text/html'])
    assert.equal(/<script/i.test(html), false)
    assert.equal(html.match(/<table/g)?.length, 1)
    assert.match(html, /<th scope="col">HTTP header<\/th><th scope="col">Value<\/th>/)
    const names = [...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map((m) => m[1])
    assert.deepEqual(names, ['Host', 'User-Agent', 'Accept'])
    assert.match(html, /<tr data-header="user-agent"><th scope="row">User-Agent<\/th><td>Probe\/1<\/td><\/tr>/)
  })

  test('escapes attacker-controlled header values', () => {
    const html = render(['User-Agent', '"><script>alert(1)</script>'])
    assert.equal(html.includes('<script>'), false)
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  })

  test('escapeHtml covers all five characters', () => {
    assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  })
})

describe('GET /request-headers', () => {
  const call = async (method: string, headers: Record<string, string> = {}) => {
    const req = mockRequest({ method, url: '/request-headers', headers })
    const out = mockResponse()
    await handler(req as NextApiRequest, out.res)
    return out
  }

  test('returns an uncached HTML page that forbids scripts', async () => {
    const out = await call('GET', { host: 'api.angaadi.dev', 'user-agent': 'Probe/2' })
    assert.equal(out.statusCode, 200)
    assert.equal(out.headers['content-type'], 'text/html; charset=utf-8')
    assert.equal(out.headers['cache-control'], 'no-store, max-age=0')
    assert.match(String(out.headers['content-security-policy']), /default-src 'none'/)
    assert.ok(String(out.jsonBody).includes('<td>Probe/2</td>'))
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
