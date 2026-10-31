import type { Metadata } from 'next';

import localFont from 'next/font/local';
import './globals.css';
import './themes.css';
import './dark.css';
import type * as React from 'react';
import { PALETTE_INIT_SCRIPT } from '@/lib/theme/palettes';
import { Providers } from './providers';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
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
  description: 'Make sure your colleagues know how to get a hold of you!',
  appleWebApp: { capable: true, title: 'WØRK', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#010101',
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
        <link rel="icon" href="./icon.svg" sizes="any" />
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
