import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import { arrivedInOffice, presentToday } from '@/lib/notifications/arrival';
import { isDigestTime } from '@/lib/notifications/schedule';

// Wednesday 2026-03-04, 08:00 Copenhagen (CET), before the Workday Default starts
const morning = new Date('2026-03-04T07:00:00Z');
const noon = new Date('2026-03-04T11:00:00Z');

function declaration(overrides: Partial<Status>): Status {
  return {
    id: 1,
    userID: 'marie',
    status: 'IN_OFFICE',
    details: null,
    emoji: null,
    time: null,
    fromDate: '2026-03-04',
    toDate: '2026-03-04',
    sourceMessageKey: null,
    startsAt: null,
    endsAt: null,
    startsAtApproximate: false,
    endsAtApproximate: false,
    announcedAt: new Date('2026-03-04T06:00:00Z'),
    createdAt: '2026-03-04T06:00:00.000Z',
    ...overrides,
  };
}

describe('arrivedInOffice', () => {
  it('is an arrival when a Declaration moves someone from home to the office', () => {
    const home = declaration({ id: 1, status: 'FROM_HOME' });
    const office = declaration({
      id: 2,
      announcedAt: new Date('2026-03-04T10:30:00Z'),
      createdAt: '2026-03-04T10:30:00.000Z',
    });
    expect(arrivedInOffice([home], [home, office], 'marie', noon)).toBe(true);
  });

  it('is an arrival when someone announces the office before the Workday Default starts', () => {
    expect(arrivedInOffice([], [declaration({})], 'marie', morning)).toBe(true);
  });

  it('is not an arrival when the person was already in the office', () => {
    const office = declaration({ id: 2 });
    expect(arrivedInOffice([], [office], 'marie', noon)).toBe(false);
  });

  it('is not an arrival when the new Declaration is not about being in the office', () => {
    const home = declaration({ status: 'FROM_HOME' });
    expect(arrivedInOffice([], [home], 'marie', noon)).toBe(false);
  });

  it('is not an arrival for a Declaration about another day', () => {
    const tomorrow = declaration({ fromDate: '2026-03-05', toDate: '2026-03-05' });
    expect(arrivedInOffice([], [tomorrow], 'marie', morning)).toBe(false);
  });
});

describe('presentToday', () => {
  it('separates people in the office from people arriving later', () => {
    const statuses = new Map<string, Status[]>([
      ['marie', []],
      ['peter', [declaration({ userID: 'peter', status: 'FROM_HOME' })]],
      [
        'lars',
        [
          declaration({
            userID: 'lars',
            status: 'IN_LATE',
            endsAt: new Date('2026-03-04T10:00:00Z'),
          }),
        ],
      ],
    ]);
    expect(presentToday(statuses, new Date('2026-03-04T08:30:00Z'))).toEqual({
      inOffice: ['marie'],
      arrivingLater: ['lars'],
    });
  });
});

describe('isDigestTime', () => {
  it('is the 09:00 hour in Copenhagen on weekdays, in winter and in summer', () => {
    expect(isDigestTime(new Date('2026-03-04T08:00:00Z'))).toBe(true);
    expect(isDigestTime(new Date('2026-07-01T07:00:00Z'))).toBe(true);
  });

  it('skips the other cron run of the pair', () => {
    expect(isDigestTime(new Date('2026-03-04T07:00:00Z'))).toBe(false);
    expect(isDigestTime(new Date('2026-07-01T08:00:00Z'))).toBe(false);
  });

  it('skips weekends', () => {
    expect(isDigestTime(new Date('2026-03-07T08:00:00Z'))).toBe(false);
  });
});
