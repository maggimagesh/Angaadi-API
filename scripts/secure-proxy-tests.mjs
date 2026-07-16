/**
 * Secure Proxy test suite.
 *
 * Covers: sanity, regression (data parity vs direct API), security (route
 * allowlist, header injection, tampering), vulnerability (replay, expiry,
 * SSRF/traversal), and pen-test style probes.
 *
 * Usage: node scripts/secure-proxy-tests.mjs [baseUrl]
 *   baseUrl defaults to http://localhost:3000/api/v1
 */

import crypto from 'node:crypto'

const BASE = (process.argv[2] || 'http://localhost:3000/api/v1').replace(/\/$/, '')

let pass = 0
let fail = 0
const failures = []

function check(name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  \x1b[32mPASS\x1b[0m ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n\x1b[1m\x1b[36m${title}\x1b[0m`)
}

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const b64uDec = (s) => Buffer.from(s, 'base64url')

// --- crypto client mirroring the browser secureClient ------------------------

async function handshake() {
  const ecdh = crypto.createECDH('prime256v1')
  const clientPub = ecdh.generateKeys()
  const res = await fetch(`${BASE}/secure/handshake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pub: b64u(clientPub) }),
  })
  if (!res.ok) throw new Error(`handshake failed ${res.status}`)
  const { pub, token, exp } = await res.json()
  const serverPub = b64uDec(pub)
  const shared = ecdh.computeSecret(serverPub)
  const salt = Buffer.concat([clientPub, serverPub])
  const key = Buffer.from(crypto.hkdfSync('sha256', shared, salt, Buffer.from('angaadi-secure-proxy-v1'), 32))
  return { key, token, exp }
}

function encrypt(key, obj) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const pt = Buffer.from(JSON.stringify(obj))
  const ct = Buffer.concat([c.update(pt), c.final(), c.getAuthTag()])
  return { iv: b64u(iv), d: b64u(ct) }
}

function decrypt(key, iv, d) {
  const raw = b64uDec(d)
  const tag = raw.subarray(raw.length - 16)
  const ct = raw.subarray(0, raw.length - 16)
  const dc = crypto.createDecipheriv('aes-256-gcm', key, b64uDec(iv))
  dc.setAuthTag(tag)
  return JSON.parse(Buffer.concat([dc.update(ct), dc.final()]).toString('utf8'))
}

function newInner(path, method, extra = {}) {
  return {
    p: path,
    m: method,
    ts: Date.now(),
    n: b64u(crypto.randomBytes(16)),
    ...extra,
  }
}

// Send a raw proxy envelope; returns the fetch Response.
async function rawProxy(token, iv, d) {
  return fetch(`${BASE}/secure/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t: token, iv, d }),
  })
}

// Full tunneled call; returns decrypted { s, b } or the raw response on non-200.
async function proxyCall(session, path, method, extra = {}) {
  const env = encrypt(session.key, newInner(path, method, extra))
  const res = await rawProxy(session.token, env.iv, env.d)
  if (res.status !== 200) return { proxyStatus: res.status, raw: await res.json().catch(() => ({})) }
  const { iv, d } = await res.json()
  return { proxyStatus: 200, ...decrypt(session.key, iv, d) }
}

async function main() {
  console.log(`\x1b[1mSecure Proxy tests against ${BASE}\x1b[0m`)

  // ---------------------------------------------------------------- SANITY
  section('1. Sanity')
  const session = await handshake()
  check('Handshake returns 32-byte session key', session.key.length === 32)
  check('Handshake token is opaque (not raw key material)', !session.token.includes(session.key.toString('base64url')))

  const products = await proxyCall(session, '/products', 'GET')
  check('GET /products tunnels with inner status 200', products.s === 200)
  check('GET /products returns products array', Array.isArray(products.b?.products))

  const bad = await proxyCall(session, '/products/by-ids', 'POST', { b: { categoryId: 999999, productId: 999999 } })
  check('POST /products/by-ids reachable through proxy', bad.proxyStatus === 200 && typeof bad.s === 'number')

  // -------------------------------------------------------------- REGRESSION
  section('2. Regression (proxy output == direct API output)')
  const direct = await (await fetch(`${BASE}/products`)).json()
  check('Proxied /products matches direct /products', JSON.stringify(products.b) === JSON.stringify(direct))

  const catDirect = await (await fetch(`${BASE}/products/by-category`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryid: direct.products?.[0]?.id ?? 1, page: 1, limit: 3 }),
  })).json()
  const catProxy = await proxyCall(session, '/products/by-category', 'POST', {
    b: { categoryid: direct.products?.[0]?.id ?? 1, page: 1, limit: 3 },
  })
  check('Proxied by-category matches direct by-category', JSON.stringify(catProxy.b) === JSON.stringify(catDirect))

  // ---------------------------------------------------------------- SECURITY
  section('3. Security — confidentiality & allowlist')
  {
    // The wire payload must not contain plaintext field names from the data.
    const env = encrypt(session.key, newInner('/products', 'GET'))
    const wire = JSON.stringify({ t: session.token, iv: env.iv, d: env.d })
    check('Request wire payload contains no plaintext path', !wire.includes('/products'))
    const res = await rawProxy(session.token, env.iv, env.d)
    const bodyText = JSON.stringify(await res.json())
    check('Response wire payload contains no plaintext product fields',
      !bodyText.includes('productname') && !bodyText.includes('imageurl'))
  }
  {
    const r = await proxyCall(session, '/system/toggle-route', 'POST', { b: { route: '/api/v1/products' } })
    check('Blocks non-allowlisted /system/* route', r.proxyStatus === 403)
  }
  {
    const r = await proxyCall(session, '/secure/proxy', 'POST', { b: {} })
    check('Blocks proxy-to-self recursion', r.proxyStatus === 403)
  }
  {
    const r = await proxyCall(session, '/products', 'DELETE')
    check('Blocks disallowed method on allowed route', r.proxyStatus === 403)
  }

  // ----------------------------------------------------------- VULNERABILITY
  section('4. Vulnerability — SSRF, traversal, injection')
  const ssrfPaths = [
    'http://169.254.169.254/latest/meta-data/',
    '//evil.com/x',
    '/../../etc/passwd',
    '/products/../users',
    '/products%2f..%2fusers',
    '/products\r\nHost: evil',
  ]
  for (const p of ssrfPaths) {
    const r = await proxyCall(session, p, 'GET')
    check(`Rejects SSRF/traversal path: ${JSON.stringify(p)}`, r.proxyStatus === 403 || r.proxyStatus === 400)
  }
  {
    // Header injection: attempt to smuggle a Host/forbidden header.
    const r = await proxyCall(session, '/products', 'GET', { h: { 'x-forwarded-for': '10.0.0.1', host: 'evil.com', 'content-length': '0' } })
    check('Strips non-allowlisted forwarded headers (request still succeeds cleanly)', r.s === 200)
  }

  section('5. Vulnerability — replay & expiry')
  {
    const inner = newInner('/products', 'GET')
    const env = encrypt(session.key, inner)
    const r1 = await rawProxy(session.token, env.iv, env.d)
    const r2 = await rawProxy(session.token, env.iv, env.d) // identical nonce
    check('First request accepted', r1.status === 200)
    check('Replayed identical envelope rejected (400)', r2.status === 400)
  }
  {
    const env = encrypt(session.key, newInner('/products', 'GET', { ts: Date.now() - 10 * 60 * 1000 }))
    const r = await rawProxy(session.token, env.iv, env.d)
    check('Stale timestamp rejected (replay window)', r.status === 400)
  }
  {
    const env = encrypt(session.key, { p: '/products', m: 'GET', ts: Date.now() }) // no nonce
    const r = await rawProxy(session.token, env.iv, env.d)
    check('Missing nonce rejected', r.status === 400)
  }

  section('6. Pen-test — tampering & forged sessions')
  {
    // Tamper one byte of ciphertext: GCM auth must fail -> decryption error.
    const env = encrypt(session.key, newInner('/products', 'GET'))
    const raw = b64uDec(env.d)
    raw[0] ^= 0xff
    const r = await rawProxy(session.token, env.iv, b64u(raw))
    check('Tampered ciphertext rejected (GCM auth)', r.status === 400)
  }
  {
    // Forged token (random) must not unwrap.
    const env = encrypt(session.key, newInner('/products', 'GET'))
    const r = await rawProxy(b64u(crypto.randomBytes(60)), env.iv, env.d)
    check('Forged session token rejected (401)', r.status === 401)
  }
  {
    // Encrypt with a wrong key but a valid token: server-side decrypt fails.
    const wrongKey = crypto.randomBytes(32)
    const env = encrypt(wrongKey, newInner('/products', 'GET'))
    const r = await rawProxy(session.token, env.iv, env.d)
    check('Envelope encrypted with wrong key rejected (400)', r.status === 400)
  }
  {
    const r = await fetch(`${BASE}/secure/proxy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: 'x', iv: 'y', d: 'z' }),
    })
    check('Garbage envelope rejected without crash', r.status === 401 || r.status === 400)
  }
  {
    const r = await fetch(`${BASE}/secure/handshake`, {
      method: 'GET',
    })
    check('Handshake rejects non-POST (405)', r.status === 405)
  }
  {
    // Malformed / oversized public key on handshake.
    const r = await fetch(`${BASE}/secure/handshake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pub: b64u(Buffer.alloc(65, 1)) }), // 0x01 prefix, not a valid point
    })
    check('Handshake rejects invalid EC point (400)', r.status === 400)
  }

  section('7. Pen-test — session isolation')
  {
    // A second session cannot decrypt a first session's response.
    const s2 = await handshake()
    const env = encrypt(session.key, newInner('/products', 'GET'))
    const res = await rawProxy(session.token, env.iv, env.d)
    const { iv, d } = await res.json()
    let leaked = false
    try { decrypt(s2.key, iv, d); leaked = true } catch { /* expected */ }
    check('Session B cannot decrypt session A response', !leaked)
  }

  // ------------------------------------------------------------------ RESULT
  console.log(`\n\x1b[1mTotal: ${pass} passed, ${fail} failed\x1b[0m`)
  if (fail > 0) {
    console.log(`\x1b[31mFailures: ${failures.join(', ')}\x1b[0m`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('\x1b[31mTest harness error:\x1b[0m', e)
  process.exit(2)
})
