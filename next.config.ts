import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'hel1.your-objectstorage.com',
        pathname: '/workbucket/profile-images/**',
      },
    ],
  },
};

export default nextConfig;
