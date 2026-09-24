import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import { dayNote, presenceOf, segmentNote, segmentWeek } from '@/components/week/presence';
import { resolveWorkWeek, workWeekDays } from '@/lib/status/week';

const days = workWeekDays('2026-09-21');
const now = new Date('2026-09-22T10:00:00Z');
const status = (values: Partial<Status>): Status => ({
  id: 7,
  userID: 'anna',
  status: 'AWAY',
  details: null,
  time: null,
  fromDate: null,
  toDate: null,
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  createdAt: '2026-09-19T07:00:00Z',
  announcedAt: new Date('2026-09-19T07:00:00Z'),
  sourceMessageKey: null,
  ...values,
});

describe('week board cells', () => {
  it('merges a multi-day declaration into one bar and notes when it ends', () => {
    const away = status({ details: 'at conference', fromDate: '2026-09-23', toDate: '2026-10-02' });
    const segments = segmentWeek(resolveWorkWeek([away], 'anna', days, now));
    expect(segments.map(({ start, span }) => [start, span])).toEqual([
      [0, 1],
      [1, 1],
      [2, 3],
    ]);
    expect(segmentNote(segments[2], days)).toBe('until 02.10 · at conference');
    expect(presenceOf(segments[0].status)).toMatchObject({ label: 'In office', group: 'office' });
  });

  it('notes a declaration that started before the visible week', () => {
    const vacation = status({ status: 'VACATION', fromDate: '2026-09-14', toDate: '2026-09-22' });
    const segments = segmentWeek(resolveWorkWeek([vacation], 'anna', days, now));
    expect(segments[0]).toMatchObject({ start: 0, span: 2 });
    expect(segmentNote(segments[0], days)).toBe('since 14.09');
  });

  it('shows arrival times, including approximate ones', () => {
    const late = status({
      status: 'IN_LATE',
      details: 'dentist',
      endsAt: new Date('2026-09-24T08:30:00Z'),
      endsAtApproximate: true,
    });
    expect(dayNote(late)).toBe('from ca. 10:30 · dentist');
    expect(presenceOf(late).group).toBe('office');
  });
});
