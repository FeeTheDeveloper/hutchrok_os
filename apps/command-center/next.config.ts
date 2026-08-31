import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // PWA config will be added via next-pwa or similar
  },
  // API routes live in the separate api app
  rewrites: async () => ({
    beforeFiles: [],
    afterFiles: [
      {
        source: '/api/:path*',
        destination: `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/api/:path*`,
      },
    ],
    fallback: [],
  }),
};

export default nextConfig;
