# Theming

The interface has two independent appearance choices, both on the profile page under
**Settings → Appearance**:

- **Mode** – light or dark (`next-themes`, the `dark` class on `<html>`). Also toggled from the page header.
- **Palette** – `default`, `ocean`, `sunset` or `lavender` (the `data-palette` attribute on `<html>`).

Every palette has a light and a dark variant, so all 8 combinations are supported. `default` is the original
WØRK look. Both choices are saved in the browser's `localStorage` (`theme` and `palette`); they are not stored
per person and do not follow a profile to another device.

## How it works

- `app/themes.css` defines the same set of `--office-*` colour tokens for every palette and mode.
  Component stylesheets use only those tokens (`var(--office-surface)`, `bg-(--office-border)`, …), never hex values,
  so a new palette needs no component changes.
- `lib/theme/palettes.ts` is the registry (ids and labels) and the small inline script that the root layout
  runs in `<head>`, so a saved palette is applied before first paint.
- `components/theme/usePalette.ts` reads and writes the choice; `components/ui/ProfileSettings` is the settings UI.
  The preview cards render with the `data-palette-preview` scope that `themes.css` also defines.

### Status colours

Attendance tones (in office, remote, sick, …), the success/error colours in the sandbox and the notice on the
profile page are meaning-bearing and identical in every palette. They live next to the components that use them,
with their dark variants in `app/dark.css`.

## Adding a palette

1. Copy a light and a dark block in `app/themes.css`, change the selectors to the new id (keep the
   `[data-palette-preview='…']` selectors) and pick colours for all tokens.
2. Add the id, label and a short description to `PALETTES` in `lib/theme/palettes.ts`.
3. Run `pnpm test:backend tests/backend/theme`. It checks that every palette defines exactly the same tokens in
   both modes and that text, links and buttons keep readable WCAG contrast on their backgrounds.

When styling something new, pick the token by role (`ink`, `muted`, `surface`, `border`, `link`, `primary`, …)
rather than by how it looks in the default palette.
