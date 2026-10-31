/**
 * The colour palettes a signed-in profile can choose between. The colours themselves live in
 * app/themes.css, keyed by these ids; every palette works in both light and dark mode.
 */
export const PALETTES = [
  { id: 'default', label: 'Default', description: 'Warm paper, soft blue' },
  { id: 'ocean', label: 'Ocean', description: 'Cool teal, deep navy' },
  { id: 'sunset', label: 'Sunset', description: 'Peach and orange' },
  { id: 'lavender', label: 'Lavender', description: 'Soft violet and purple' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export const DEFAULT_PALETTE: PaletteId = 'default';
export const PALETTE_STORAGE_KEY = 'palette';

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((palette) => palette.id === value);
}

const customPaletteIds = PALETTES.filter((palette) => palette.id !== DEFAULT_PALETTE).map(
  (palette) => palette.id
);

/**
 * Runs in <head> before first paint so a saved palette never flashes the default one. "default"
 * is the absence of the attribute.
 */
export const PALETTE_INIT_SCRIPT =
  `(function(){try{var p=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});` +
  `if(${JSON.stringify(customPaletteIds)}.indexOf(p)>-1)` +
  `document.documentElement.setAttribute('data-palette',p)}catch(e){}})()`;
