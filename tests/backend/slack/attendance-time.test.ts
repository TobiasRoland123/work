import { describe, expect, it } from 'vitest';
import { copenhagenDate, localDateTimeToUtc } from '@/lib/slack/attendance-time';

describe('attendance time helpers', () => {
  it('formats Copenhagen dates across UTC boundaries', () => {
    expect(copenhagenDate(new Date('2026-01-15T23:30:00.000Z'))).toBe('2026-01-16');
  });

  it('converts normal Copenhagen wall-clock times', () => {
    expect(localDateTimeToUtc('2026-01-15', '09:30')?.toISOString()).toBe('2026-01-15T08:30:00.000Z');
  });

  it('rejects nonexistent and ambiguous DST times', () => {
    expect(localDateTimeToUtc('2026-03-29', '02:30')).toBeNull();
    expect(localDateTimeToUtc('2026-10-25', '02:30')).toBeNull();
  });
});
