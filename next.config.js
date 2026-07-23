/** @type {import('next').NextConfig} */
const nextConfig = {
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
