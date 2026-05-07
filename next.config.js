/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
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
    ]
  },
}

module.exports = nextConfig
