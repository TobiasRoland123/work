import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'WØRK',
    short_name: 'WØRK',
    description: 'Keep up with your colleagues and set your work status.',
    lang: 'en',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    background_color: '#090b0c',
    theme_color: '#090b0c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'My profile', short_name: 'Profile', url: '/profile' },
      { name: 'Find a colleague', short_name: 'Contact', url: '/contact' },
    ],
  };
}
