import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import {
  isoWeekNumber,
  parseWorkWeekStart,
  resolveWorkWeek,
  workWeekDays,
  workWeekStart,
} from '@/lib/status/week';

const row = (values: Partial<Status> = {}): Status => ({
  id: 1,
  userID: 'person',
  status: 'VACATION',
  details: null,
  time: null,
  fromDate: '2026-09-22',
  toDate: '2026-09-23',
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  sourceMessageKey: null,
  announcedAt: new Date('2026-09-18T08:00:00Z'),
  createdAt: '2026-09-18 10:00:00',
  ...values,
});
const week = workWeekDays('2026-09-21');
const statuses = (rows: Status[], now: string) =>
  resolveWorkWeek(rows, 'person', week, new Date(now)).map((day) => day.status?.status ?? null);

describe('work week', () => {
  it('snaps weekdays to Monday and weekends to the coming week', () => {
    expect(workWeekStart('2026-09-23')).toBe('2026-09-21');
    expect(workWeekStart('2026-09-21')).toBe('2026-09-21');
    expect(workWeekStart('2026-09-26')).toBe('2026-09-28');
    expect(workWeekStart('2026-09-27')).toBe('2026-09-28');
    expect(week).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
  });

  it('falls back to the current Copenhagen week for invalid input', () => {
    // 23:30 UTC on Sunday is already Monday in Copenhagen.
    const now = new Date('2026-09-27T23:30:00Z');
    expect(parseWorkWeekStart('2026-02-31', now)).toBe('2026-09-28');
    expect(parseWorkWeekStart(['2026-09-01'], now)).toBe('2026-09-28');
    expect(parseWorkWeekStart('2026-10-07', now)).toBe('2026-10-05');
  });

  it('numbers weeks across year boundaries', () => {
    expect(isoWeekNumber('2026-09-21')).toBe(39);
    expect(isoWeekNumber('2026-12-28')).toBe(53);
    expect(isoWeekNumber('2027-01-04')).toBe(1);
  });

  it('applies declarations to their own days and the workday default elsewhere', () => {
    expect(statuses([row()], '2026-09-21T06:00:00Z')).toEqual([
      'IN_OFFICE',
      'VACATION',
      'VACATION',
      'IN_OFFICE',
      'IN_OFFICE',
    ]);
  });

  it('shows a planned late arrival on its day and resolves today live', () => {
    const late = row({
      status: 'IN_LATE',
      fromDate: '2026-09-24',
      toDate: '2026-09-24',
      time: new Date('2026-09-24T08:00:00Z'),
    });
    expect(statuses([late], '2026-09-21T10:00:00Z')[3]).toBe('IN_LATE');
    const lateToday = {
      ...late,
      fromDate: '2026-09-21',
      toDate: '2026-09-21',
      time: new Date('2026-09-21T08:00:00Z'),
    };
    expect(statuses([lateToday], '2026-09-21T07:30:00Z')[0]).toBe('IN_LATE');
    expect(statuses([lateToday], '2026-09-21T08:30:00Z')[0]).toBe('IN_OFFICE');
  });
});
