import type { NextApiRequest, NextApiResponse } from 'next'
import { withCORS } from '@/middleware/cors'
import { performHandshake } from '@/lib/secureProxy'
import { rateLimit } from '@/lib/proxyPolicy'

/**
 * POST /api/v1/secure/handshake
 *
 * Ephemeral ECDH (P-256) key exchange. The client sends its ephemeral public
 * key; the server derives an AES-256-GCM session key and returns its own
 * public key plus an opaque token (the session key wrapped under the server
 * master key). No session state is stored server-side.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!rateLimit(req, 'handshake', 30)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const pub = req.body?.pub
  if (typeof pub !== 'string') {
    return res.status(400).json({ error: 'Missing client public key' })
  }

  const result = performHandshake(pub)
  if (!result) {
    return res.status(400).json({ error: 'Invalid client public key' })
  }

  return res.status(200).json({
    pub: result.serverPublicKey,
    token: result.token,
    exp: result.expiresAt,
  })
}

export default withCORS(handler)
