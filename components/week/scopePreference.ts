export const WEEK_SCOPE_COOKIE = 'week-scope';

/** The Week page shows a single day or a whole work week. */
export type WeekScope = 'day' | 'week';

/** A single day unless the visitor last looked at a whole week. */
export const weekScope = (cookieValue: string | undefined): WeekScope =>
  cookieValue === 'week' ? 'week' : 'day';

/** A cookie rather than local storage, so the server opens the page in the remembered scope. */
export function rememberWeekScope(scope: WeekScope) {
  document.cookie = `${WEEK_SCOPE_COOKIE}=${scope}; path=/; max-age=31536000; samesite=lax`;
}
