import { and, gte, isNull, lt, lte, or } from 'drizzle-orm';
import { status } from '@/db/schema';
import { copenhagenDate, copenhagenWallClock } from '@/lib/status/active';
import { addDays } from '@/lib/status/week';

export function overviewStatusWindow(days: readonly string[], now: Date) {
  const dates = [copenhagenDate(now), ...days].sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return {
    first,
    last,
    startsAt: copenhagenWallClock(first, 0, 0),
    endsAt: copenhagenWallClock(addDays(last, 1), 0, 0),
  };
}

type Window = ReturnType<typeof overviewStatusWindow>;

/** Keep open date bounds and clock endpoints: either can suppress a day's office default. */
export function overviewStatusCondition(window: Window) {
  return or(
    and(
      or(isNull(status.fromDate), lte(status.fromDate, window.last)),
      or(isNull(status.toDate), gte(status.toDate, window.first))
    ),
    and(gte(status.startsAt, window.startsAt), lt(status.startsAt, window.endsAt)),
    and(gte(status.endsAt, window.startsAt), lt(status.endsAt, window.endsAt))
  );
}
