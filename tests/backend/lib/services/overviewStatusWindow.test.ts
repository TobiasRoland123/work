import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Status } from '@/db/types';
import { resolvePresenceStatus } from '@/lib/status/active';
import { resolveWorkWeek } from '@/lib/status/week';
import { overviewStatusCondition, overviewStatusWindow } from '@/lib/services/overviewStatusWindow';

const row = (values: Partial<Status>): Status => ({
  id: 1,
  userID: 'anna',
  status: 'AWAY',
  details: null,
  emoji: null,
  time: null,
  fromDate: '2020-01-01',
  toDate: '2020-01-01',
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  announcedAt: new Date('2026-10-25T07:00:00Z'),
  createdAt: '2026-10-25 08:00:00',
  sourceMessageKey: null,
  ...values,
});
const now = new Date('2026-10-26T12:00:00Z');
const days = ['2026-10-25', '2026-10-27'];
const window = overviewStatusWindow(days, now);

// Model the SQL's conservative candidate set, then compare its business behavior
// against the unfiltered history. The generated SQL is asserted separately below.
function statusMayAffectOverview(row: Status, window: ReturnType<typeof overviewStatusWindow>) {
  if ((!row.fromDate || row.fromDate <= window.last) && (!row.toDate || row.toDate >= window.first))
    return true;
  return [row.startsAt, row.endsAt].some((value) => {
    if (!value) return false;
    const clock = new Date(value).getTime();
    return clock >= window.startsAt.getTime() && clock < window.endsAt.getTime();
  });
}

describe('overview status window', () => {
  it('includes actual today and uses Copenhagen midnights across the DST change', () => {
    expect(window).toEqual({
      first: '2026-10-25',
      last: '2026-10-27',
      startsAt: new Date('2026-10-24T22:00:00Z'),
      endsAt: new Date('2026-10-27T23:00:00Z'),
    });
    expect(overviewStatusWindow(['2026-10-20'], now).last).toBe('2026-10-26');
  });

  it.each([
    ['expired date range', row({})],
    ['future date range', row({ fromDate: '2030-01-01', toDate: '2030-02-01' })],
    ['spanning dates', row({ fromDate: '2026-10-24', toDate: '2026-10-28' })],
    ['open start', row({ fromDate: null, toDate: '2026-10-26' })],
    ['open end', row({ fromDate: '2026-10-26', toDate: null })],
    ['legacy no dates', row({ fromDate: null, toDate: null, announcedAt: null })],
    ['conflicting start clock', row({ startsAt: new Date('2026-10-26T08:00:00Z') })],
    ['expired clock still suppresses default', row({ endsAt: new Date('2026-10-26T08:00:00Z') })],
    [
      'approximate clock',
      row({ endsAt: new Date('2026-10-26T08:00:00Z'), endsAtApproximate: true }),
    ],
    [
      'legacy arrival',
      row({
        status: 'IN_OFFICE',
        time: new Date('2026-10-26T09:00:00Z'),
        fromDate: null,
        toDate: null,
      }),
    ],
    ['midnight clock', row({ startsAt: window.startsAt })],
    ['exclusive next midnight', row({ startsAt: window.endsAt })],
  ])('preserves full-history resolution for %s', (_, candidate) => {
    const history = [row({ id: 99, fromDate: '2010-01-01', toDate: '2010-01-02' }), candidate];
    const filtered = history.filter((status) => statusMayAffectOverview(status, window));
    expect(resolvePresenceStatus(filtered, 'anna', now)).toEqual(
      resolvePresenceStatus(history, 'anna', now)
    );
    expect(resolveWorkWeek(filtered, 'anna', days, now)).toEqual(
      resolveWorkWeek(history, 'anna', days, now)
    );
  });

  it('drops large expired histories while retaining clock-only default suppression', () => {
    const clock = row({ endsAt: new Date('2026-10-26T08:00:00Z') });
    const history = [...Array.from({ length: 500 }, (_, id) => row({ id })), clock];
    const filtered = history.filter((status) => statusMayAffectOverview(status, window));
    expect(filtered).toEqual([clock]);
    expect(resolvePresenceStatus(filtered, 'anna', now)).toBeNull();
    expect(resolvePresenceStatus(filtered, 'anna', now)).toEqual(
      resolvePresenceStatus(history, 'anna', now)
    );
  });

  it('applies the date overlap and both half-open clock escapes to the database query', () => {
    const query = new PgDialect().sqlToQuery(overviewStatusCondition(window)!);
    expect(query.sql).toBe(
      '((("status"."from_date" is null or "status"."from_date" <= $1) and ("status"."to_date" is null or "status"."to_date" >= $2)) or ("status"."starts_at" >= $3 and "status"."starts_at" < $4) or ("status"."ends_at" >= $5 and "status"."ends_at" < $6))'
    );
    expect(query.params).toEqual([
      window.last,
      window.first,
      window.startsAt.toISOString(),
      window.endsAt.toISOString(),
      window.startsAt.toISOString(),
      window.endsAt.toISOString(),
    ]);
  });
});
