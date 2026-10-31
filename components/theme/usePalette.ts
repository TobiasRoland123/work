'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  isPaletteId,
  type PaletteId,
} from '@/lib/theme/palettes';

const listeners = new Set<() => void>();

function readPalette(): PaletteId {
  const value = document.documentElement.getAttribute('data-palette');
  return isPaletteId(value) ? value : DEFAULT_PALETTE;
}

function applyPalette(palette: PaletteId) {
  if (palette === DEFAULT_PALETTE) document.documentElement.removeAttribute('data-palette');
  else document.documentElement.setAttribute('data-palette', palette);
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the palette.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PALETTE_STORAGE_KEY) return;
    applyPalette(isPaletteId(event.newValue) ? event.newValue : DEFAULT_PALETTE);
    notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The colour palette chosen on the profile page. It is stored in this browser only and applied as
 * `data-palette` on <html> (see app/themes.css); the inline script in the root layout restores it
 * before first paint.
 */
export function usePalette() {
  const palette = useSyncExternalStore(subscribe, readPalette, () => DEFAULT_PALETTE);

  const setPalette = useCallback((next: PaletteId) => {
    applyPalette(next);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the palette still applies for this visit.
    }
    notify();
  }, []);

  return { palette, setPalette };
}
