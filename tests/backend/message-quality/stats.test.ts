import { describe, expect, it } from 'vitest';
import { messageWeek, shiftCalendarWeek, weeklyConversion } from '@/lib/message-quality/stats';

describe('message conversion calendar weeks', () => {
  it('keeps weekend messages in their own week instead of the next work week', () => {
    expect(messageWeek('2026-09-26')).toBe('2026-09-21');
    expect(messageWeek('2026-09-27')).toBe('2026-09-21');
    expect(messageWeek('2026-09-28')).toBe('2026-09-28');
  });

  it('uses Copenhagen midnight across summer and winter time', () => {
    expect(messageWeek(undefined, new Date('2026-09-27T21:59:59Z'))).toBe('2026-09-21');
    expect(messageWeek(undefined, new Date('2026-09-27T22:00:00Z'))).toBe('2026-09-28');
    expect(messageWeek(undefined, new Date('2026-10-25T22:59:59Z'))).toBe('2026-10-19');
    expect(messageWeek(undefined, new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });

  it('falls back for invalid dates and supports weeks spanning years', () => {
    const now = new Date('2026-09-27T10:00:00Z');
    expect(messageWeek('2026-02-30', now)).toBe('2026-09-21');
    expect(messageWeek(['2026-09-21'], now)).toBe('2026-09-21');
    expect(messageWeek('2027-01-01')).toBe('2026-12-28');
    expect(shiftCalendarWeek('2027-01-04', -1)).toBe('2026-12-28');
  });

  it('counts one conversion per message and keeps pending in the denominator', () => {
    expect(
      weeklyConversion('2026-09-21', { total: 3, converted: 1, unconverted: 1, pending: 1 })
    ).toMatchObject({ percentage: 33.3, pending: 1 });
    expect(weeklyConversion('2026-09-21').percentage).toBeNull();
    expect(weeklyConversion('2026-09-21', { total: 2, unconverted: 2 }).percentage).toBe(0);
  });
});
