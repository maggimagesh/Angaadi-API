import type { NextApiRequest, NextApiResponse } from 'next'

function getSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'undefined') {
    return null
  }

  return Array.isArray(value) ? value.join(', ') : value
}

export function applyPublicWebhookCors(req: NextApiRequest, res: NextApiResponse): void {
  const requestedHeaders = getSingleHeaderValue(req.headers['access-control-request-headers'])
  const requestedMethods = getSingleHeaderValue(req.headers['access-control-request-method'])

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', requestedMethods || 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', requestedHeaders || '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length')
  res.setHeader('Access-Control-Max-Age', '86400')
}
