import type { NextApiRequest } from 'next'

export interface MockRequestOptions {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  remoteAddress?: string
  /** Raw request body. The capture path consumes the request as a stream. */
  body?: Buffer | string
}

// Minimal stand-in for what the webhook auth layer actually reads off a request:
// method, url, headers and the socket fields collectSenderInfo touches.
export function mockRequest(options: MockRequestOptions = {}): NextApiRequest {
  const {
    method = 'POST',
    url = '/api/hook/abcdefghij',
    headers = {},
    remoteAddress = '203.0.113.7',
    body,
  } = options

  const bodyBuffer = typeof body === 'string' ? Buffer.from(body, 'utf8') : body

  const normalizedHeaders: Record<string, string | string[] | undefined> = {}
  for (const [name, value] of Object.entries(headers)) {
    normalizedHeaders[name.toLowerCase()] = value
  }

  return {
    method,
    url,
    httpVersion: '1.1',
    headers: normalizedHeaders,
    query: {},
    cookies: {},
    body: undefined,
    // captureWebhookRequest reads the body by iterating the request, so the
    // mock has to behave like the readable stream a real handler receives.
    async *[Symbol.asyncIterator]() {
      if (bodyBuffer && bodyBuffer.length > 0) {
        yield bodyBuffer
      }
    },
    socket: {
      remoteAddress,
      remotePort: 51234,
      remoteFamily: 'IPv4',
      encrypted: false,
    },
  } as unknown as NextApiRequest
}

// Builds a capture URL the way a real sender would, so tests exercise the same
// percent-encoding path the API sees on the wire.
export function captureUrl(
  token: string,
  params: Array<[string, string]> = [],
  basePath = '/api/hook'
): string {
  const base = `${basePath}/${token}`
  if (params.length === 0) {
    return base
  }
  const search = params
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${base}?${search}`
}
