export const WEEK_PANEL_COOKIE = 'week-panel';

/** The side panel is open unless the visitor has explicitly closed it. */
export const isWeekPanelOpen = (cookieValue: string | undefined) => cookieValue !== 'closed';

/** A cookie rather than local storage, so the server renders the right layout with no flash. */
export function rememberWeekPanel(open: boolean) {
  document.cookie = `${WEEK_PANEL_COOKIE}=${open ? 'open' : 'closed'}; path=/; max-age=31536000; samesite=lax`;
}
