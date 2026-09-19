import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import { resolvePresenceStatus } from '@/lib/status/active';

const day = '2026-09-10';
const row = (values: Partial<Status> = {}): Status => ({
  id: 1,
  userID: 'person',
  status: 'IN_OFFICE',
  details: null,
  time: null,
  fromDate: day,
  toDate: day,
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  sourceMessageKey: null,
  announcedAt: new Date(`${day}T04:00:00Z`),
  createdAt: `${day} 06:00:00`,
  ...values,
});
const at = (time: string) => new Date(`${day}T${time}:00Z`);
const resolve = (rows: Status[], time: string) => resolvePresenceStatus(rows, 'person', at(time));

describe('office presence convention', () => {
  it('does not spawn before 9 and defaults exactly at 9 in summer', () => {
    expect(resolve([], '06:59')).toBeNull();
    expect(resolve([], '07:00')).toMatchObject({ status: 'IN_OFFICE', userID: 'person', id: 0 });
  });
  it('uses Copenhagen winter time and resets the following morning', () => {
    expect(resolvePresenceStatus([], 'person', new Date('2026-12-10T07:59:59Z'))).toBeNull();
    expect(resolvePresenceStatus([], 'person', new Date('2026-12-10T08:00:00Z'))?.status).toBe(
      'IN_OFFICE'
    );
    expect(resolvePresenceStatus([row()], 'person', new Date('2026-09-11T06:00:00Z'))).toBeNull();
  });
  it('spawns an explicit 7am arrival at 7, never earlier', () => {
    const arrival = row({ startsAt: at('05:00') });
    expect(resolve([arrival], '04:59')).toBeNull();
    expect(resolve([arrival], '05:00')?.status).toBe('IN_OFFICE');
  });
  it.each(['FROM_HOME', 'SICK', 'VACATION', 'AT_CLIENT'] as const)(
    'preserves an explicit %s declaration after 9',
    (status) => {
      expect(resolve([row({ status })], '08:00')?.status).toBe(status);
    }
  );
  it('keeps description-only announcements without inventing office attendance', () => {
    expect(
      resolve([row({ status: null, details: 'Away from Slack this morning' })], '08:00')?.status
    ).toBeNull();
  });
  it('resolves legacy manual arrival times and retains approximate arrivals', () => {
    const late = row({ status: 'IN_LATE', time: at('08:00'), fromDate: null, toDate: null });
    expect(resolve([late], '07:30')?.status).toBe('IN_LATE');
    expect(resolve([late], '08:00')?.status).toBe('IN_OFFICE');
    expect(resolve([{ ...late, endsAtApproximate: true }], '08:30')?.status).toBe('IN_LATE');
  });
  it('shows office presence until a manual departure, with its departure note', () => {
    const early = row({ status: 'LEAVING_EARLY', time: at('12:00') });
    expect(resolve([early], '10:00')).toMatchObject({
      status: 'IN_OFFICE',
      details: 'Leaving at 14:00',
    });
    expect(resolve([early], '12:00')?.status).toBe('LEAVING_EARLY');
  });
  it('does not override a newer explicit status with a timed transition', () => {
    const late = row({ status: 'IN_LATE', time: at('08:00') });
    const home = row({ id: 2, status: 'FROM_HOME', announcedAt: at('07:00') });
    expect(resolve([late, home], '09:00')?.status).toBe('FROM_HOME');
  });
  it('does not let next week’s vacation suppress today, but respects today’s future arrival', () => {
    expect(
      resolve([row({ status: 'VACATION', fromDate: '2026-09-14', toDate: '2026-09-18' })], '07:00')
        ?.status
    ).toBe('IN_OFFICE');
    expect(resolve([row({ startsAt: at('10:00') })], '07:00')).toBeNull();
  });
  it('does not default on weekends but honors explicit weekend arrival', () => {
    const now = new Date('2026-09-12T08:00:00Z');
    expect(resolvePresenceStatus([], 'person', now)).toBeNull();
    expect(
      resolvePresenceStatus(
        [row({ fromDate: '2026-09-12', toDate: '2026-09-12', status: 'IN_LATE', time: now })],
        'person',
        now
      )?.status
    ).toBe('IN_OFFICE');
  });
});
