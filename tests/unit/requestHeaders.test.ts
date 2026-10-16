// Unit and endpoint tests for /api/v1/request-headers.
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import type { NextApiRequest } from 'next'
import { buildRequestHeadersReport, isProxyHeader, isSensitiveHeader, listHeaders } from '@/utils/requestHeaders'
import handler from '../../pages/api/v1/request-headers.ts'
import { mockRequest } from '../helpers/mockRequest.ts'
import { mockResponse } from '../helpers/mockResponse.ts'

describe('listHeaders', () => {
  test('keeps arrival order, original casing and repeated headers from rawHeaders', () => {
    const headers = listHeaders({
      headers: {},
      rawHeaders: ['Host', 'angaadi.dev', 'Accept', 'text/html', 'X-Forwarded-For', '1.2.3.4', 'Accept', '*/*'],
    })
    assert.deepEqual(
      headers.map((h) => [h.name, h.value]),
      [
        ['Host', 'angaadi.dev'],
        ['Accept', 'text/html'],
        ['X-Forwarded-For', '1.2.3.4'],
        ['Accept', '*/*'],
      ]
    )
  })

  test('falls back to the parsed map, one row per value', () => {
    const headers = listHeaders({ headers: { 'set-thing': ['a', 'b'], host: 'x' } })
    assert.deepEqual(
      headers.map((h) => [h.name, h.value]),
      [
        ['set-thing', 'a'],
        ['set-thing', 'b'],
        ['host', 'x'],
      ]
    )
  })

  test('flags credentials as sensitive and edge headers as proxy', () => {
    assert.equal(isSensitiveHeader('Authorization'), true)
    assert.equal(isSensitiveHeader('Cookie'), true)
    assert.equal(isSensitiveHeader('Accept'), false)
    assert.equal(isProxyHeader('X-Vercel-Id'), true)
    assert.equal(isProxyHeader('x-forwarded-proto'), true)
    assert.equal(isProxyHeader('User-Agent'), false)
  })
})

describe('buildRequestHeadersReport', () => {
  test('summarises method, protocol, ip and user agent', () => {
    const report = buildRequestHeadersReport(
      {
        method: 'get',
        url: '/api/v1/request-headers?x=1',
        httpVersion: '1.1',
        headers: {
          host: 'api.angaadi.dev',
          'user-agent': 'TestAgent/1.0',
          'x-forwarded-proto': 'https',
          'x-forwarded-for': '198.51.100.4, 10.0.0.1',
        },
        socket: { remoteAddress: '::ffff:10.0.0.1' },
      },
      new Date('2026-01-01T00:00:00Z')
    )
    assert.equal(report.method, 'GET')
    assert.equal(report.protocol, 'https')
    assert.equal(report.host, 'api.angaadi.dev')
    assert.equal(report.path, '/api/v1/request-headers')
    assert.equal(report.ip, '198.51.100.4')
    assert.equal(report.userAgent, 'TestAgent/1.0')
    assert.equal(report.headerCount, 4)
    assert.equal(report.timestamp, '2026-01-01T00:00:00.000Z')
  })

  test('uses the socket address when no forwarding header is present', () => {
    const report = buildRequestHeadersReport({ headers: {}, socket: { remoteAddress: '::ffff:203.0.113.9' } })
    assert.equal(report.ip, '203.0.113.9')
    assert.equal(report.protocol, 'http')
  })
})

describe('GET /api/v1/request-headers', () => {
  const call = async (method: string, headers: Record<string, string> = {}) => {
    const req = mockRequest({ method, url: '/api/v1/request-headers', headers })
    const out = mockResponse()
    await handler(req as NextApiRequest, out.res)
    return out
  }

  test('echoes the request headers and is never cached', async () => {
    const out = await call('GET', { Accept: 'application/json', 'User-Agent': 'Probe/2' })
    assert.equal(out.statusCode, 200)
    assert.equal(out.headers['cache-control'], 'no-store, max-age=0')
    const body = out.jsonBody as { headers: Array<{ name: string; value: string }>; userAgent: string }
    assert.equal(body.userAgent, 'Probe/2')
    assert.ok(body.headers.some((h) => h.name === 'accept' && h.value === 'application/json'))
  })

  test('HEAD returns no body', async () => {
    const out = await call('HEAD')
    assert.equal(out.statusCode, 200)
    assert.equal(out.jsonBody, undefined)
  })

  test('rejects other methods with 405', async () => {
    const out = await call('POST')
    assert.equal(out.statusCode, 405)
    assert.equal(out.headers.allow, 'GET, HEAD, OPTIONS')
  })
})
