export const WEEK_LAYOUT_COOKIE = 'week-layout';

/** Colleagues grouped by status, or one list with the newest announcement first. */
export type WeekLayout = 'grouped' | 'chronological';

/** Grouped unless the visitor has explicitly chosen the chronological list. */
export const weekLayout = (cookieValue: string | undefined): WeekLayout =>
  cookieValue === 'chronological' ? 'chronological' : 'grouped';

/** A cookie rather than local storage, so the server renders the chosen layout with no flash. */
export function rememberWeekLayout(layout: WeekLayout) {
  document.cookie = `${WEEK_LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax`;
}
