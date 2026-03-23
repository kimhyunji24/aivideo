/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8080'}/api/:path*`,
      },
      {
        source: '/generated-images/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8080'}/generated-images/:path*`,
      },
      {
        source: '/generated-videos/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8080'}/generated-videos/:path*`,
      },
    ];
  },
}

export default nextConfig
