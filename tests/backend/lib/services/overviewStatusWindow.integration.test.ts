import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')('overview status candidate query', () => {
  const client = new Client();
  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });

  // PostgreSQL executes the production predicate against isolated VALUES rows. There are no
  // persistent writes and no second implementation of the overlap logic in this test.
  async function filterHistory(history: Status[]) {
    const query = new PgDialect().sqlToQuery(overviewStatusCondition(window)!);
    const params: unknown[] = [...query.params];
    const tuples = history.map((item) => {
      const values = [item.id, item.fromDate, item.toDate, item.startsAt, item.endsAt];
      const types = ['integer', 'date', 'date', 'timestamptz', 'timestamptz'];
      return `(${values
        .map((value, index) => {
          params.push(value);
          return `$${params.length}::${types[index]}`;
        })
        .join(', ')})`;
    });
    const result = await client.query<{ id: number }>(
      `WITH "status" ("id", "from_date", "to_date", "starts_at", "ends_at") AS (VALUES ${tuples.join(', ')}) SELECT "id" FROM "status" WHERE ${query.sql}`,
      params
    );
    const ids = new Set(result.rows.map((item) => item.id));
    return history.filter((item) => ids.has(item.id));
  }
  it.each([
    ['expired date range', row({}), false],
    ['future date range', row({ fromDate: '2030-01-01', toDate: '2030-02-01' }), false],
    ['spanning dates', row({ fromDate: '2026-10-24', toDate: '2026-10-28' }), true],
    ['open start', row({ fromDate: null, toDate: '2026-10-26' }), true],
    ['open end', row({ fromDate: '2026-10-26', toDate: null }), true],
    ['legacy no dates', row({ fromDate: null, toDate: null, announcedAt: null }), true],
    ['conflicting start clock', row({ startsAt: new Date('2026-10-26T08:00:00Z') }), true],
    [
      'expired clock still suppresses default',
      row({ endsAt: new Date('2026-10-26T08:00:00Z') }),
      true,
    ],
    [
      'approximate clock',
      row({ endsAt: new Date('2026-10-26T08:00:00Z'), endsAtApproximate: true }),
      true,
    ],
    [
      'legacy arrival',
      row({
        status: 'IN_OFFICE',
        time: new Date('2026-10-26T09:00:00Z'),
        fromDate: null,
        toDate: null,
      }),
      true,
    ],
    ['midnight clock', row({ startsAt: window.startsAt }), true],
    ['exclusive next midnight', row({ startsAt: window.endsAt }), false],
  ] as const)(
    'selects candidates and preserves full-history resolution for %s',
    async (_, candidate, included) => {
      const history = [row({ id: 99, fromDate: '2010-01-01', toDate: '2010-01-02' }), candidate];
      const filtered = await filterHistory(history);
      expect(filtered.map((status) => status.id)).toEqual(included ? [candidate.id] : []);
      expect(resolvePresenceStatus(filtered, 'anna', now)).toEqual(
        resolvePresenceStatus(history, 'anna', now)
      );
      expect(resolveWorkWeek(filtered, 'anna', days, now)).toEqual(
        resolveWorkWeek(history, 'anna', days, now)
      );
    }
  );

  it('drops large expired histories while retaining clock-only default suppression', async () => {
    const clock = row({ id: 501, endsAt: new Date('2026-10-26T08:00:00Z') });
    const history = [...Array.from({ length: 500 }, (_, id) => row({ id })), clock];
    const filtered = await filterHistory(history);
    expect(filtered).toEqual([clock]);
    expect(resolvePresenceStatus(filtered, 'anna', now)).toBeNull();
    expect(resolvePresenceStatus(filtered, 'anna', now)).toEqual(
      resolvePresenceStatus(history, 'anna', now)
    );
  });
});
