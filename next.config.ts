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

  /* config options here */
  images: {
    domains: ['picsum.photos'],
  },
};

export default nextConfig;
