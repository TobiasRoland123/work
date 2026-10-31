'use client';

import { Check, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { usePalette } from '@/components/theme/usePalette';
import { PALETTES } from '@/lib/theme/palettes';
import './profile-settings.css';

const MODES = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
] as const;

const subscribeToNothing = () => () => {};

/** Appearance settings: light or dark mode, and the colour palette. Both are saved in this browser. */
export function ProfileSettings() {
  const { resolvedTheme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  // The saved mode is only known in the browser.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );

  return (
    <section className="profile-settings" aria-labelledby="profile-settings-heading">
      <div className="profile-settings__heading">
        <span>Settings</span>
        <h2 id="profile-settings-heading">Appearance</h2>
      </div>

      <fieldset className="profile-settings__group">
        <legend>Mode</legend>
        <div className="profile-settings__modes">
          {MODES.map(({ id, label, Icon }) => (
            <label className="settings-choice mode-card" key={id}>
              <input
                type="radio"
                name="color-mode"
                value={id}
                className="sr-only"
                checked={hydrated && resolvedTheme === id}
                onChange={() => setTheme(id)}
              />
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              <Check className="settings-choice__check" size={16} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="profile-settings__group">
        <legend>Palette</legend>
        <p className="profile-settings__hint">
          Every palette comes in light and dark. Your choice is saved in this browser.
        </p>
        <div className="profile-settings__palettes">
          {PALETTES.map(({ id, label, description }) => (
            <label className="settings-choice palette-card" key={id}>
              <input
                type="radio"
                name="color-palette"
                value={id}
                className="sr-only"
                checked={palette === id}
                onChange={() => setPalette(id)}
              />
              <PalettePreview id={id} />
              <span className="palette-card__label">
                {label}
                <Check className="settings-choice__check" size={16} aria-hidden="true" />
              </span>
              <span className="palette-card__description">{description}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

/** A miniature screen painted with the palette's own colours in the current mode. */
function PalettePreview({ id }: { id: string }) {
  return (
    <span className="palette-card__preview" data-palette-preview={id} aria-hidden="true">
      <span className="palette-card__rail" />
      <span className="palette-card__screen">
        <span className="palette-card__panel">
          <span className="palette-card__line palette-card__line--ink" />
          <span className="palette-card__line palette-card__line--muted" />
        </span>
        <span className="palette-card__swatches">
          <i className="palette-card__swatch palette-card__swatch--accent" />
          <i className="palette-card__swatch palette-card__swatch--selected" />
          <i className="palette-card__swatch palette-card__swatch--primary" />
        </span>
      </span>
    </span>
  );
}
