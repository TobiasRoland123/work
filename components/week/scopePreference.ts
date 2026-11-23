import { copenhagenDate } from '@/lib/status/active';
import { workWeekStart } from '@/lib/status/week';

export const WEEK_SCOPE_COOKIE = 'week-scope';

/** The Week page shows a single day or a whole work week. */
export type WeekScope = 'day' | 'week';

const listeners = new Set<() => void>();

/** A single day unless the visitor last looked at a whole week. */
export const weekScope = (cookieValue: string | undefined): WeekScope =>
  cookieValue === 'week' ? 'week' : 'day';

/** Read the visitor's remembered Week scope from document.cookie in the browser. */
export function readWeekScope(): WeekScope {
  if (typeof document === 'undefined') return 'day';
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${WEEK_SCOPE_COOKIE}=([^;]*)`));
  return weekScope(match ? decodeURIComponent(match[1]) : undefined);
}

/** Subscribe to updates made via rememberWeekScope in the current browser tab. */
export function subscribeWeekScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Direct Week entry href matching the visitor's remembered scope, avoiding a redirect hop. */
export function weekEntryHref(scope: WeekScope, now: Date = new Date()): string {
  return scope === 'week' ? `/today?week=${workWeekStart(copenhagenDate(now))}` : '/today';
}

/** A cookie rather than local storage, so the server opens the page in the remembered scope. */
export function rememberWeekScope(scope: WeekScope) {
  document.cookie = `${WEEK_SCOPE_COOKIE}=${scope}; path=/; max-age=31536000; samesite=lax`;
  for (const listener of listeners) {
    listener();
  }
}
