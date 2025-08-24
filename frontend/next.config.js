/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.API_PROXY_TARGET || 'http://localhost:4000'
    const minio = process.env.MINIO_PROXY_TARGET || 'http://localhost:9000'
    const strip = (u) => u.replace(/\/$/, '')
    return [
      {
        source: '/api/:path*',
        destination: `${strip(backend)}/:path*`,
      },
      {
        source: '/files/:bucket/:path*',
        destination: `${strip(minio)}/:bucket/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
