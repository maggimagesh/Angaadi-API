import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose'
import { NextApiRequest } from 'next'

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key'

export interface JWTPayload extends JoseJWTPayload {
  sub: string
  emailId: string
}

export async function signToken(payload: { sub: string; emailId: string }): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 7 * 24 * 60 * 60 // 7 days

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    
    // Cast the payload to our custom interface
    return payload as unknown as JWTPayload
  } catch (error) {
    throw new Error('Invalid token')
  }
}

export async function authenticateRequest(req: NextApiRequest): Promise<JWTPayload | null> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    return await verifyToken(token)
  } catch (error) {
    return null
  }
}