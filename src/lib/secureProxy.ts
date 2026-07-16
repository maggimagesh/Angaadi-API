import crypto from 'crypto'

/**
 * Secure Proxy crypto core.
 *
 * Session keys are negotiated via an ephemeral ECDH (P-256) handshake and
 * returned to the client wrapped (AES-256-GCM) under a server-side master
 * key, so the proxy stays stateless across serverless instances.
 */

const HKDF_INFO = 'angaadi-secure-proxy-v1'
const TOKEN_AAD = Buffer.from('apx1')
const SESSION_TTL_MS = 15 * 60 * 1000 // 15 minutes

let cachedMasterKey: Buffer | null = null

export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey
  const secret = process.env.PROXY_MASTER_KEY || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('PROXY_MASTER_KEY (or JWT_SECRET) must be configured')
  }
  cachedMasterKey = Buffer.from(
    crypto.hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.from('angaadi-proxy-master'), Buffer.from(HKDF_INFO), 32)
  )
  return cachedMasterKey
}

export function b64uEncode(buf: Buffer): string {
  return buf.toString('base64url')
}

export function b64uDecode(value: string): Buffer | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4 * 1024 * 1024) return null
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    return Buffer.from(value, 'base64url')
  } catch {
    return null
  }
}

export interface HandshakeResult {
  serverPublicKey: string // base64url uncompressed P-256 point
  token: string // wrapped session key
  expiresAt: number
}

/** Perform the server side of the ECDH handshake for a client public key. */
export function performHandshake(clientPublicKeyB64u: string): HandshakeResult | null {
  const clientPub = b64uDecode(clientPublicKeyB64u)
  // Uncompressed P-256 point: 0x04 || X(32) || Y(32)
  if (!clientPub || clientPub.length !== 65 || clientPub[0] !== 0x04) return null

  const ecdh = crypto.createECDH('prime256v1')
  const serverPub = ecdh.generateKeys()

  let sharedSecret: Buffer
  try {
    sharedSecret = ecdh.computeSecret(clientPub)
  } catch {
    return null // invalid point / not on curve
  }

  const salt = Buffer.concat([clientPub, serverPub])
  const sessionKey = Buffer.from(
    crypto.hkdfSync('sha256', sharedSecret, salt, Buffer.from(HKDF_INFO), 32)
  )

  const expiresAt = Date.now() + SESSION_TTL_MS
  const token = wrapSessionKey(sessionKey, expiresAt)

  return { serverPublicKey: b64uEncode(serverPub), token, expiresAt }
}

function wrapSessionKey(sessionKey: Buffer, expiresAt: number): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv)
  cipher.setAAD(TOKEN_AAD)
  const payload = Buffer.from(JSON.stringify({ k: sessionKey.toString('base64url'), exp: expiresAt }))
  const ct = Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()])
  return b64uEncode(Buffer.concat([iv, ct]))
}

export function unwrapSessionToken(token: string): { key: Buffer; exp: number } | null {
  const raw = b64uDecode(token)
  if (!raw || raw.length < 12 + 16 + 2) return null
  try {
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(raw.length - 16)
    const ct = raw.subarray(12, raw.length - 16)
    const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), iv)
    decipher.setAAD(TOKEN_AAD)
    decipher.setAuthTag(tag)
    const payload = JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'))
    const key = b64uDecode(payload.k)
    if (!key || key.length !== 32 || typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    return { key, exp: payload.exp }
  } catch {
    return null
  }
}

export function encryptEnvelope(key: Buffer, data: unknown): { iv: string; d: string } {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8')
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
  return { iv: b64uEncode(iv), d: b64uEncode(ct) }
}

export function decryptEnvelope(key: Buffer, ivB64u: string, dataB64u: string): unknown | null {
  const iv = b64uDecode(ivB64u)
  const raw = b64uDecode(dataB64u)
  if (!iv || iv.length !== 12 || !raw || raw.length < 16 + 2) return null
  try {
    const tag = raw.subarray(raw.length - 16)
    const ct = raw.subarray(0, raw.length - 16)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    return JSON.parse(plaintext)
  } catch {
    return null
  }
}
