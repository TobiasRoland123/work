import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },

  /* config options here */
  images: {
    domains: ['picsum.photos'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hel1.your-objectstorage.com',
        pathname: '/workbucket/profile-images/**',
      },
    ],
  },
};

export default nextConfig;
