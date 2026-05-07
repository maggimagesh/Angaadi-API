import type { NextApiRequest, NextApiResponse } from 'next'

function getSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'undefined') {
    return null
  }

  return Array.isArray(value) ? value.join(', ') : value
}

const SAFE_CORS_HEADER_VALUE = /^[A-Za-z0-9 ,\-]+$/

function sanitizeCorsHeaderValue(value: string | null): string | null {
  if (!value) {
    return null
  }

  const stripped = value.replace(/[\r\n]/g, '').trim()
  if (!stripped || stripped.length > 1024 || !SAFE_CORS_HEADER_VALUE.test(stripped)) {
    return null
  }

  return stripped
}

export function applyPublicWebhookCors(req: NextApiRequest, res: NextApiResponse): void {
  const requestedHeaders = sanitizeCorsHeaderValue(
    getSingleHeaderValue(req.headers['access-control-request-headers'])
  )
  const requestedMethods = sanitizeCorsHeaderValue(
    getSingleHeaderValue(req.headers['access-control-request-method'])
  )

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', requestedMethods || 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', requestedHeaders || '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length')
  res.setHeader('Access-Control-Max-Age', '86400')
}
