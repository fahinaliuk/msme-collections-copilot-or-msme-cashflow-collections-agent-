/** @type {import('next').NextConfig} */
const apiBase = process.env.API_URL || 'http://127.0.0.1:8000'

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
