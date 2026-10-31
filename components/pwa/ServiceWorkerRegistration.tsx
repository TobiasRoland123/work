'use client';

import { useEffect } from 'react';

/** Registers the service worker that makes the app installable and receives push notifications. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed', error);
    });
  }, []);
  return null;
}
