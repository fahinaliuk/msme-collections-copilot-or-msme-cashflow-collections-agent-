/** @type {import('next').NextConfig} */
const apiBase = process.env.API_URL || 'http://127.0.0.1:8000'

const nextConfig = {
  reactStrictMode: true,
  // Rewrites: only active when frontend and backend are served from same domain
  // (Docker Compose, or Nginx proxy). When NEXT_PUBLIC_API_URL is set (Vercel + Render),
  // the axios client calls the backend URL directly and rewrites are not needed.
  async rewrites() {
    // Skip rewrites when NEXT_PUBLIC_API_URL is set (direct API calls)
    if (process.env.NEXT_PUBLIC_API_URL) {
      return []
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
