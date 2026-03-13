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
}

export interface WebhookResponseInfo {
  statusCode: number
  headers: Record<string, string>
  body: unknown | null
  text: string | null
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
  body: WebhookStoredBody
  response: WebhookResponseInfo
}

export interface WebhookCaptureListResponse {
  token: string
  captureUrl: string
  inspectUrl: string
  requests: WebhookCaptureRecord[]
}
