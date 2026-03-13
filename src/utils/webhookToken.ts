const WEBHOOK_TOKEN_REGEX = /^[A-Za-z0-9_-]{10,128}$/

export function createWebhookToken(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }

  const buffer = new Uint8Array(16)
  crypto.getRandomValues(buffer)

  return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('')
}

export function isValidWebhookToken(token: string): boolean {
  return WEBHOOK_TOKEN_REGEX.test(token)
}
