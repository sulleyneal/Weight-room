import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The connector server is API + MCP only — no static export, standard
  // Vercel serverless deployment.
  reactStrictMode: true,
}

export default nextConfig
