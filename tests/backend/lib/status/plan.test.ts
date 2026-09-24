import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import { dayRuns, planStatuses, upcomingStatuses } from '@/lib/status/plan';
import { resolveWorkWeek, workWeekDays } from '@/lib/status/week';
import { dayNote } from '@/components/week/presence';

// Wednesday 23 September 2026, 10:00 in Copenhagen (summer time).
const now = new Date('2026-09-23T08:00:00Z');
const plan = (input: object) => planStatuses(input, now);

describe('planning ahead', () => {
  it('groups picked days into runs and bridges weekends', () => {
    expect(dayRuns(['2026-09-24', '2026-09-25', '2026-09-28', '2026-10-01'])).toEqual([
      ['2026-09-24', '2026-09-28'],
      ['2026-10-01', '2026-10-01'],
    ]);
    expect(
      plan({
        status: 'FROM_HOME',
        details: 'focus',
        when: { kind: 'days', days: ['2026-09-25', '2026-09-24', '2026-09-24'] },
      })
    ).toEqual([
      {
        status: 'FROM_HOME',
        details: 'focus',
        fromDate: '2026-09-24',
        toDate: '2026-09-25',
        time: null,
      },
    ]);
  });

  it('stores timed statuses per day at Copenhagen wall-clock time', () => {
    const rows = plan({
      status: 'IN_LATE',
      time: '10:30',
      when: { kind: 'days', days: ['2026-09-24', '2026-10-26'] },
    });
    // 10:30 is 08:30Z in summer time and 09:30Z after the switch to winter time.
    expect(rows.map((row) => [row.fromDate, row.toDate, (row.time as Date).toISOString()])).toEqual(
      [
        ['2026-09-24', '2026-09-24', '2026-09-24T08:30:00.000Z'],
        ['2026-10-26', '2026-10-26', '2026-10-26T09:30:00.000Z'],
      ]
    );
  });

  it('rejects past days, passed times and inverted periods with readable messages', () => {
    expect(() =>
      plan({ status: 'FROM_HOME', when: { kind: 'days', days: ['2026-09-22'] } })
    ).toThrow('Pick today or a later day.');
    expect(() =>
      plan({ status: 'LEAVING_EARLY', time: '09:30', when: { kind: 'days', days: ['2026-09-23'] } })
    ).toThrow('That time has already passed today.');
    expect(() => plan({ status: 'IN_LATE', when: { kind: 'days', days: ['2026-09-24'] } })).toThrow(
      'Choose a time.'
    );
    expect(() =>
      plan({ status: 'VACATION', when: { kind: 'range', from: '2026-10-02', to: '2026-09-28' } })
    ).toThrow('The end date must be on or after the start date.');
    expect(() =>
      plan({ status: 'VACATION', when: { kind: 'range', from: '2026-02-30', to: '2026-03-02' } })
    ).toThrow('not a valid date');
  });

  it('keeps a period as one declaration and drops details for sickness', () => {
    expect(
      plan({
        status: 'VACATION',
        details: 'Mallorca',
        when: { kind: 'range', from: '2026-09-21', to: '2026-10-02' },
      })
    ).toEqual([
      {
        status: 'VACATION',
        details: 'Mallorca',
        fromDate: '2026-09-21',
        toDate: '2026-10-02',
        time: null,
      },
    ]);
    expect(
      plan({ status: 'SICK', details: 'flu', when: { kind: 'days', days: ['2026-09-23'] } })[0]
        .details
    ).toBeNull();
  });

  it('shows planned days on the week board', () => {
    const rows: Status[] = [
      ...plan({ status: 'AT_CLIENT', when: { kind: 'days', days: ['2026-09-24'] } }),
      ...plan({ status: 'IN_LATE', time: '10:00', when: { kind: 'days', days: ['2026-09-25'] } }),
    ].map((row, index) => ({
      ...row,
      id: index + 1,
      userID: 'me',
      status: row.status ?? null,
      details: row.details ?? null,
      fromDate: row.fromDate ?? null,
      toDate: row.toDate ?? null,
      time: row.time ?? null,
      startsAt: null,
      endsAt: null,
      startsAtApproximate: false,
      endsAtApproximate: false,
      sourceMessageKey: null,
      announcedAt: now,
      createdAt: now.toISOString(),
    }));
    const week = resolveWorkWeek(rows, 'me', workWeekDays('2026-09-21'), now);
    expect(week.map((day) => day.status?.status)).toEqual([
      'IN_OFFICE',
      'IN_OFFICE',
      'IN_OFFICE',
      'AT_CLIENT',
      'IN_LATE',
    ]);
    expect(dayNote(week[4].status)).toBe('from 10:00');

    const upcoming = upcomingStatuses(
      [...rows, { ...rows[0], id: 9, fromDate: '2026-09-21', toDate: '2026-09-22' }],
      now
    );
    expect(upcoming.map((row) => [row.id, row.firstDay, row.lastDay])).toEqual([
      [1, '2026-09-24', '2026-09-24'],
      [2, '2026-09-25', '2026-09-25'],
    ]);
  });
});
