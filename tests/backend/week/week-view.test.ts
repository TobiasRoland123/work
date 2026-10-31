import { describe, expect, it } from 'vitest';
import { resolveWeekView } from '@/lib/status/week';

const now = new Date('2026-10-14T10:00:00Z');

describe('resolveWeekView', () => {
  it('follows today when the URL names no day or week', () => {
    expect(resolveWeekView({}, now)).toEqual({});
    expect(resolveWeekView({ week: null, day: null }, now)).toEqual({});
  });

  it('snaps a week to its Monday', () => {
    expect(resolveWeekView({ week: '2026-10-15' }, now)).toEqual({ week: '2026-10-12' });
  });

  it('keeps an explicit day and lets the week win over it', () => {
    expect(resolveWeekView({ day: '2026-10-13' }, now)).toEqual({ day: '2026-10-13' });
    expect(resolveWeekView({ week: '2026-10-12', day: '2026-10-13' }, now)).toEqual({
      week: '2026-10-12',
    });
  });

  it('falls back to the current week or day for invalid values', () => {
    expect(resolveWeekView({ week: 'nonsense' }, now)).toEqual({ week: '2026-10-12' });
    expect(resolveWeekView({ day: 'nonsense' }, now)).toEqual({ day: '2026-10-14' });
  });
});
