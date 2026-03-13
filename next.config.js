/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  },
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
