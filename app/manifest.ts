import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WØRK',
    short_name: 'WØRK',
    description: 'Who is in the Copenhagen office today.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#010101',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
