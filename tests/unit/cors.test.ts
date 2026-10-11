// Unit tests for the CORS origin whitelist.
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import { getAllowedOrigins, isOriginAllowed } from '@/utils/cors'

describe('isOriginAllowed', () => {
  const defaults = getAllowedOrigins('')

  test('allows angaadi.dev and its subdomains', () => {
    assert.equal(isOriginAllowed('https://angaadi.dev', defaults), true)
    assert.equal(isOriginAllowed('https://www.angaadi.dev', defaults), true)
    assert.equal(isOriginAllowed('https://webhooks.angaadi.dev', defaults), true)
  })

  test('allows a future TLD with no config change', () => {
    assert.equal(isOriginAllowed('https://angaadi.app', defaults), true)
    assert.equal(isOriginAllowed('https://www.angaadi.shop', defaults), true)
    assert.equal(isOriginAllowed('https://angaadi.co.in', defaults), true)
  })

  test('keeps previous domains working', () => {
    assert.equal(isOriginAllowed('https://angaadi.online', defaults), true)
    assert.equal(isOriginAllowed('https://angaad.online', defaults), true)
    assert.equal(isOriginAllowed('https://angaadi.vercel.app', defaults), true)
  })

  test('ALLOWED_ORIGINS is merged with the defaults instead of replacing them', () => {
    const allowed = getAllowedOrigins('https://staging.example.com/, https://*.preview.example.com')
    assert.equal(isOriginAllowed('https://staging.example.com', allowed), true)
    assert.equal(isOriginAllowed('https://a.preview.example.com', allowed), true)
    assert.equal(isOriginAllowed('http://localhost:5173', allowed), true)
  })

  test('rejects look-alike and unknown origins', () => {
    for (const origin of [
      'http://angaadi.dev',
      'https://angaadi.dev.evil.com',
      'https://evilangaadi.dev',
      'https://angaadi-dev.com',
      'https://angaadi.dev:8443',
      'https://evil.com',
      'https://a.preview.example.com',
      'null',
    ]) {
      assert.equal(isOriginAllowed(origin, defaults), false, origin)
    }
    assert.equal(isOriginAllowed(undefined, defaults), false)
  })
})
