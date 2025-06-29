import type { Metadata } from 'next';

import localFont from 'next/font/local';
import './globals.css';
import type * as React from 'react';
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
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
    >
      <head>
        <link rel="icon" href="./icon.svg" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  );
}
