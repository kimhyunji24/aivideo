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
        destination: 'http://localhost:8080/api/:path*',
      },
      {
        source: '/generated-images/:path*',
        destination: 'http://localhost:8080/generated-images/:path*',
      },
      {
        source: '/generated-videos/:path*',
        destination: 'http://localhost:8080/generated-videos/:path*',
      },
    ];
  },
}

export default nextConfig
