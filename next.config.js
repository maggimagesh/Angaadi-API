/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // JSON API only: webhook capture/inspector routes keep their own headers.
        source: '/api/v1/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
  experimental: {
    instrumentationHook: true,
  },
  async rewrites() {
    return [
      {
        // Clean URL for the crawler 400-Bad-Request fixture page.
        source: '/bad-request',
        destination: '/bad-request/index.html',
      },
      {
        // Server-rendered "what headers did my browser send" page.
        source: '/request-headers',
        destination: '/api/request-headers-page',
      },
      {
        source: '/callback',
        destination: '/api/callback',
      },
      {
        source: '/hook/:token',
        destination: '/api/hook/:token',
      },
      {
        source: '/hook/:token/:path*',
        destination: '/api/hook/:token/:path*',
      },
      {
        source: '/valid-webhooks/:token',
        destination: '/api/hook/:token',
      },
      {
        source: '/valid-webhooks/:token/:path*',
        destination: '/api/hook/:token/:path*',
      },
    ]
  },
}

module.exports = nextConfig
