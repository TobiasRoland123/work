import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { overviewStatusCondition, overviewStatusWindow } from '@/lib/services/overviewStatusWindow';

const now = new Date('2026-10-26T12:00:00Z');
const days = ['2026-10-25', '2026-10-27'];
const window = overviewStatusWindow(days, now);

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

  it('covers today alone when no dates are requested', () => {
    expect(overviewStatusWindow([], now)).toEqual({
      first: '2026-10-26',
      last: '2026-10-26',
      startsAt: new Date('2026-10-25T23:00:00Z'),
      endsAt: new Date('2026-10-26T23:00:00Z'),
    });
  });

  it('sorts requested days and includes today before future days', () => {
    expect(overviewStatusWindow(['2026-10-30', '2026-10-28', '2026-10-30'], now)).toEqual({
      first: '2026-10-26',
      last: '2026-10-30',
      startsAt: new Date('2026-10-25T23:00:00Z'),
      endsAt: new Date('2026-10-30T23:00:00Z'),
    });
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
