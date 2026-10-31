import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_INIT_SCRIPT,
  PALETTE_STORAGE_KEY,
  isPaletteId,
} from '@/lib/theme/palettes';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const themesCss = readFileSync(path.join(root, 'app/themes.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

type Mode = 'light' | 'dark';
type Tokens = Record<string, string>;

/** palette id -> mode -> token name (without --office-) -> value, read from app/themes.css. */
function parseThemes() {
  const result: Record<string, Partial<Record<Mode, Tokens>>> = {};
  for (const [, selectors, body] of themesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const tokens: Tokens = {};
    for (const [, name, value] of body.matchAll(/--office-([a-z-]+):\s*([^;]+);/g)) {
      tokens[name] = value.trim();
    }
    if (!Object.keys(tokens).length) continue;
    for (const selector of selectors.split(',').map((s) => s.trim())) {
      const palette = /\[data-palette(?:-preview)?='(\w+)'\]/.exec(selector)?.[1] ?? 'default';
      const mode: Mode = selector.includes('html.dark') ? 'dark' : 'light';
      result[palette] ??= {};
      result[palette][mode] = { ...result[palette][mode], ...tokens };
    }
  }
  return result;
}

const themes = parseThemes();
const modes: Mode[] = ['light', 'dark'];

function luminance(hex: string) {
  const full = hex.length === 4 ? hex.replace(/[a-f\d]/gi, '$&$&') : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('palette registry', () => {
  it('lists default first, with unique ids and labels', () => {
    expect(PALETTES[0].id).toBe(DEFAULT_PALETTE);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    expect(new Set(PALETTES.map((p) => p.label)).size).toBe(PALETTES.length);
  });

  it('keeps the current look as "default" and adds three more palettes', () => {
    expect(PALETTES.map((p) => p.id)).toEqual(['default', 'ocean', 'sunset', 'lavender']);
  });

  it('recognises only registered ids', () => {
    expect(isPaletteId('ocean')).toBe(true);
    expect(isPaletteId('neon')).toBe(false);
    expect(isPaletteId(null)).toBe(false);
  });
});

describe('themes.css', () => {
  it('defines every registered palette and nothing else', () => {
    expect(Object.keys(themes).sort()).toEqual(PALETTES.map((p) => p.id).sort());
  });

  const reference = Object.keys(themes.default?.light ?? {}).sort();

  it('has a token set to compare against', () => {
    expect(reference.length).toBeGreaterThan(20);
  });

  for (const { id } of PALETTES) {
    for (const mode of modes) {
      describe(`${id} · ${mode}`, () => {
        const tokens = themes[id]?.[mode];

        it('exists', () => {
          expect(tokens).toBeDefined();
        });

        it('defines exactly the same tokens as every other palette', () => {
          expect(Object.keys(tokens ?? {}).sort()).toEqual(reference);
        });

        it('only uses hex colours', () => {
          for (const [name, value] of Object.entries(tokens ?? {})) {
            expect(value, name).toMatch(/^#(?:[\da-f]{3}|[\da-f]{6})$/i);
          }
        });
      });
    }
  }

  it('gives every palette its own light and dark look', () => {
    for (const { id } of PALETTES) {
      if (id === DEFAULT_PALETTE) continue;
      for (const mode of modes) {
        expect(themes[id][mode]?.canvas).not.toBe(themes.default[mode]?.canvas);
        expect(themes[id][mode]?.accent).not.toBe(themes.default[mode]?.accent);
      }
    }
    for (const id of Object.keys(themes)) {
      expect(themes[id].dark?.canvas).not.toBe(themes[id].light?.canvas);
    }
  });
});

describe('contrast (WCAG)', () => {
  const textOn = [
    // [text token, background tokens, minimum ratio]
    ['ink', ['canvas', 'page', 'surface', 'raised', 'raised-soft', 'inset', 'hover', 'chip'], 7],
    ['ink', ['selected', 'hover-blue'], 7],
    [
      'muted',
      ['canvas', 'page', 'surface', 'raised', 'raised-soft', 'inset', 'hover', 'chip'],
      4.5,
    ],
    ['subtle', ['surface'], 4.5],
    ['subtle', ['canvas', 'page', 'raised', 'raised-soft'], 3.5],
    ['faint', ['surface', 'canvas', 'page', 'raised'], 3],
    ['link', ['surface', 'canvas', 'page', 'raised', 'selected', 'hover-blue'], 4.5],
    ['primary-ink', ['primary', 'primary-hover', 'primary-active'], 4.5],
    ['accent-ink', ['accent'], 4.5],
  ] as const;

  for (const { id } of PALETTES) {
    for (const mode of modes) {
      it(`${id} · ${mode} text is readable on its backgrounds`, () => {
        const tokens = themes[id][mode]!;
        for (const [text, backgrounds, minimum] of textOn) {
          for (const background of backgrounds) {
            expect(
              contrast(tokens[text], tokens[background]),
              `${text} on ${background}`
            ).toBeGreaterThanOrEqual(minimum);
          }
        }
      });

      it(`${id} · ${mode} navigation rail text is readable`, () => {
        const tokens = themes[id][mode]!;
        expect(contrast('#ffffff', tokens.rail)).toBeGreaterThanOrEqual(7);
        expect(contrast('#ffffff', tokens['rail-hover'])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('token usage', () => {
  const known = new Set(Object.keys(themes.default.light ?? {}));

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(css|tsx?)$/.test(entry.name) ? [full] : [];
    });
  }

  it('only references --office-* tokens that every palette defines', () => {
    const unknown: string[] = [];
    for (const dir of ['app', 'components']) {
      for (const file of sourceFiles(path.join(root, dir))) {
        const text = readFileSync(file, 'utf8');
        for (const [, name] of text.matchAll(/--office-([a-z][a-z-]*)/g)) {
          if (!known.has(name)) unknown.push(`${path.relative(root, file)}: --office-${name}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });
});

describe('palette init script', () => {
  function run(saved: string | null | 'throws') {
    const attributes: Record<string, string> = {};
    const storage = {
      getItem(key: string) {
        if (saved === 'throws') throw new Error('blocked');
        return key === PALETTE_STORAGE_KEY ? saved : null;
      },
    };
    const doc = {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
    };
    new Function('localStorage', 'document', PALETTE_INIT_SCRIPT)(storage, doc);
    return attributes;
  }

  it('restores a saved palette before first paint', () => {
    expect(run('ocean')).toEqual({ 'data-palette': 'ocean' });
    expect(run('lavender')).toEqual({ 'data-palette': 'lavender' });
  });

  it('leaves the default look when nothing valid is saved', () => {
    expect(run(null)).toEqual({});
    expect(run('default')).toEqual({});
    expect(run('neon')).toEqual({});
  });

  it('survives blocked storage', () => {
    expect(run('throws')).toEqual({});
  });
});
