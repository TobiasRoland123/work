import type { Metadata, Viewport } from 'next';

import localFont from 'next/font/local';
import './globals.css';
import './themes.css';
import './dark.css';
import type * as React from 'react';
import { PALETTE_INIT_SCRIPT } from '@/lib/theme/palettes';
import { Providers } from './providers';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { InstallAppProvider } from '@/components/pwa/InstallApp';
const monumentGrotesk = localFont({
  src: [
    {
      path: '../public/fonts/monument-grotesk/ABCMonumentGrotesk-Light-Trial.woff2',
      weight: '300',
      style: 'normal',
    },
  ],
  variable: '--font-monument-grotesk',
  display: 'block',
  preload: true,
});

const ibxMono = localFont({
  src: [
    {
      path: '../public/fonts/IBMPlexMono/IBMPlexMono-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/IBMPlexMono/IBMPlexMono-Regular.ttf',
      weight: '350',
      style: 'normal',
    },
  ],
  variable: '--font-ibx-mono', // CSS variable for the font
  display: 'block',
  preload: true,
});

export const metadata: Metadata = {
  title: 'WØRK',
  applicationName: 'WØRK',
  appleWebApp: { capable: true, title: 'WØRK', statusBarStyle: 'black' },
  icons: {
    icon: { url: '/icon.svg', type: 'image/svg+xml' },
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
  description: 'Make sure your colleagues know how to get a hold of you!',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090b0c',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${monumentGrotesk.variable} ${ibxMono.variable} font-sans antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }} />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <Providers>
          <InstallAppProvider>{children}</InstallAppProvider>
        </Providers>
      </body>
    </html>
  );
}
