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
      null,
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

  it('uses the Copenhagen calendar date for today, including the UTC date boundary', () => {
    const monday = workWeekDays('2026-09-21');
    const beforeCopenhagenMidnight = resolveWorkWeek(
      [],
      'person',
      monday,
      new Date('2026-09-21T21:59:00Z')
    );
    const afterCopenhagenMidnight = resolveWorkWeek(
      [],
      'person',
      monday,
      new Date('2026-09-21T22:01:00Z')
    );

    expect(beforeCopenhagenMidnight[0].status?.id).toBe(0);
    expect(afterCopenhagenMidnight[1].status).toBeNull();
  });

  it('resolves today before 09:00 as absent and from 09:00 using the actual current time', () => {
    const today = ['2026-09-21'];

    expect(
      resolveWorkWeek([], 'person', today, new Date('2026-09-21T06:59:00Z'))[0].status
    ).toBeNull();
    expect(
      resolveWorkWeek([], 'person', today, new Date('2026-09-21T07:00:00Z'))[0].status
    ).toMatchObject({ id: 0, status: 'IN_OFFICE' });
  });

  it('keeps weekend today on the weekend instead of resolving the coming Monday', () => {
    const sunday = resolveWorkWeek([], 'person', ['2026-09-27'], new Date('2026-09-27T10:00:00Z'));

    expect(sunday).toEqual([{ date: '2026-09-27', status: null, announcement: null }]);
  });
});

describe('daily announcements alongside live presence', () => {
  const day = '2026-10-30';
  const arrival = new Date(`${day}T08:30:00Z`); // 09:30 Copenhagen winter time.
  const late = row({
    status: 'IN_LATE',
    fromDate: day,
    toDate: day,
    startsAt: new Date(`${day}T00:00:00+01:00`),
    endsAt: arrival,
    sourceMessageKey: 'channel:message',
    details: 'Dentist first',
    announcedAt: new Date(`${day}T06:00:00Z`),
  });
  const office = {
    ...late,
    id: 2,
    status: 'IN_OFFICE' as const,
    startsAt: arrival,
    endsAt: new Date('2026-10-31T00:00:00+01:00'),
    details: null,
  };
  const resolve = (rows: Status[], clock: string, date = day) =>
    resolveWorkWeek(rows, 'person', [date], new Date(`${date}T${clock}Z`))[0];

  it.each([
    ['08:29:59', 'IN_LATE'],
    ['08:30:00', 'IN_OFFICE'],
    ['16:00:00', 'IN_OFFICE'],
    ['22:59:59', 'IN_OFFICE'],
  ])('keeps the imported announcement at %s while presence is %s', (clock, presence) => {
    const result = resolve([late, office], clock);
    expect(result.status?.status).toBe(presence);
    expect(result.announcement).toEqual(late);
  });

  it.each(['AWAY', 'FROM_HOME', 'REMOTE'] as const)(
    'retains a timed %s declaration after its office return',
    (status) => {
      const exception = { ...late, status };
      const result = resolve([exception, office], '16:00:00');
      expect(result.announcement).toEqual(exception);
      expect(result.status?.status).toBe('IN_OFFICE');
    }
  );

  it('expires the daily announcement at Copenhagen midnight', () => {
    const result = resolveWorkWeek(
      [late, office],
      'person',
      ['2026-10-31'],
      new Date('2026-10-30T23:00:00Z')
    )[0];
    expect(result.announcement).toBeNull();
    expect(result.status).toBeNull();
  });

  it.each(['IN_LATE', 'LEAVING_EARLY', 'IN_OFFICE'] as const)(
    'retains a manual %s announcement before and after its clock',
    (status) => {
      const manual = {
        ...late,
        sourceMessageKey: null,
        startsAt: null,
        endsAt: null,
        status,
        time: arrival,
      };
      for (const clock of ['07:00:00', '08:30:00', '16:00:00']) {
        expect(resolve([manual], clock).announcement).toMatchObject({
          status: status === 'IN_OFFICE' ? 'IN_LATE' : status,
          time: arrival,
        });
      }
    }
  );

  it.each([null, 'channel:new-message', 'channel:message'])(
    'lets a newer declaration or revision replace the old exception (%s)',
    (sourceMessageKey) => {
      const newer = {
        ...office,
        id: 3,
        sourceMessageKey,
        announcedAt: new Date(`${day}T10:00:00Z`),
      };
      expect(resolve([late, office, newer], '16:00:00').announcement).toEqual(newer);
    }
  );

  it('lets a newer correction replace the imported announcement', () => {
    const correction = {
      ...late,
      id: 3,
      status: 'FROM_HOME' as const,
      sourceMessageKey: null,
      startsAt: null,
      endsAt: null,
      announcedAt: new Date(`${day}T10:00:00Z`),
    };
    expect(resolve([late, office, correction], '16:00:00').announcement).toEqual(correction);
  });

  it('does not reuse an older exception from the same Slack source revision', () => {
    const old = { ...late, announcedAt: new Date(`${day}T05:00:00Z`) };
    expect(resolve([old, office], '16:00:00').announcement).toEqual(office);
  });
});
