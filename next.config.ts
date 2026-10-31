import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // A lockfile in a parent directory must not move the workspace root away from this repo.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Fully prefetched Contact/Profile pages are reusable for one minute.
    // Week uses default prefetching and must fetch fresh attendance on navigation.
    staleTimes: { dynamic: 0, static: 60 },
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },

  async headers() {
    return [
      {
        // A stale service worker would keep serving old push handling, so always revalidate it.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },

  /* config options here */
  images: {
    domains: ['picsum.photos'],
  },
};

export default nextConfig;
