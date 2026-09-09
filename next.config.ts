import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
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
