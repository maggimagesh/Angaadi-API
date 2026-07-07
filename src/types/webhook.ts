export type WebhookBodyFormat = 'empty' | 'json' | 'text' | 'binary'
export type WebhookBodyEncoding = 'none' | 'utf8' | 'base64'

export interface WebhookStoredBody {
  format: WebhookBodyFormat
  encoding: WebhookBodyEncoding
  sizeBytes: number
  contentType: string | null
  text: string | null
  json: unknown | null
  base64: string | null
  preview: string | null
  truncated?: boolean
  downloadUrl?: string | null
}

export interface WebhookResponseInfo {
  statusCode: number
  headers: Record<string, string>
  body: unknown | null
  text: string | null
}

export interface WebhookSenderGeo {
  country: string | null
  region: string | null
  city: string | null
  latitude: string | null
  longitude: string | null
  timezone: string | null
  source: string | null
}

export interface WebhookForwardedInfo {
  for: string[]
  proto: string | null
  host: string | null
  port: string | null
  raw: string | null
}

export interface WebhookSenderInfo {
  ip: string | null
  ipSource: string | null
  ipChain: string[]
  remoteAddress: string | null
  remotePort: number | null
  remoteFamily: string | null
  reverseDns: string[] | null
  userAgent: string | null
  clientApp: string | null
  httpVersion: string | null
  protocol: 'http' | 'https' | null
  secureConnection: boolean
  host: string | null
  origin: string | null
  referer: string | null
  accept: string | null
  acceptLanguage: string | null
  acceptEncoding: string | null
  contentType: string | null
  contentLength: number | null
  transferEncoding: string | null
  connection: string | null
  authorizationPresent: boolean
  signatureHeaders: Record<string, string>
  forwarded: WebhookForwardedInfo
  proxyHeaders: Record<string, string>
  geo: WebhookSenderGeo | null
}

export interface WebhookCaptureRecord {
  id: string
  token: string
  receivedAt: string
  method: string
  path: string
  url: string
  query: Record<string, string | string[]>
  headers: Record<string, string | string[]>
  cookies: Record<string, string>
  ip: string | null
  sender?: WebhookSenderInfo
  body: WebhookStoredBody
  response: WebhookResponseInfo
}

export interface WebhookCaptureListResponse {
  token: string
  captureUrl: string
  inspectUrl: string
  requests: WebhookCaptureRecord[]
}
