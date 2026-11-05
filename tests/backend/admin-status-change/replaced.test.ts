import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import { copenhagenWallClock } from '@/lib/status/active';
import { replacedAnnouncements } from '@/lib/status/admin-change';

const revision = '1790000000.123456';
const messageKey = `T:C:${revision}`;
const revisionTime = new Date(Number(revision) * 1000);

function declaration(values: Partial<Status>): Status {
  return {
    id: 1,
    userID: 'janus',
    status: 'AWAY',
    details: null,
    emoji: null,
    time: null,
    fromDate: null,
    toDate: null,
    startsAt: null,
    endsAt: null,
    startsAtApproximate: false,
    endsAtApproximate: false,
    createdAt: '2026-11-01T07:00:00Z',
    announcedAt: new Date('2026-11-01T07:00:00Z'),
    sourceMessageKey: null,
    ...values,
  };
}

describe('replacedAnnouncements', () => {
  const imported = declaration({
    id: 10,
    status: 'AWAY',
    details: 'Workshop@NNI',
    fromDate: '2026-11-05',
    toDate: '2026-11-06',
    startsAt: copenhagenWallClock('2026-11-05', 0, 0),
    endsAt: copenhagenWallClock('2026-11-07', 0, 0),
    sourceMessageKey: messageKey,
    announcedAt: revisionTime,
  });

  it('records the imported status and revision an admin overwrote', () => {
    const result = replacedAnnouncements(
      [imported],
      { fromDate: '2026-11-05', toDate: '2026-11-05' },
      new Map([[messageKey, revision]])
    );
    expect(result).toEqual([
      {
        statusId: 10,
        status: 'AWAY',
        details: 'Workshop@NNI',
        sourceMessageKey: messageKey,
        sourceRevision: revision,
        fromDay: '2026-11-05',
        toDay: '2026-11-05',
      },
    ]);
  });

  it('groups consecutive days and leaves out days without a Declaration', () => {
    const result = replacedAnnouncements(
      [imported],
      { fromDate: '2026-11-04', toDate: '2026-11-09' },
      new Map([[messageKey, revision]])
    );
    expect(result.map(({ fromDay, toDay }) => [fromDay, toDay])).toEqual([
      ['2026-11-05', '2026-11-06'],
    ]);
  });

  it('keeps the import link without a revision once the message was edited', () => {
    const [entry] = replacedAnnouncements(
      [imported],
      { fromDate: '2026-11-05', toDate: '2026-11-05' },
      new Map([[messageKey, '1790000999.000000']])
    );
    expect(entry).toMatchObject({ sourceMessageKey: messageKey, sourceRevision: null });
  });

  it('marks a status the person set themselves as not imported', () => {
    const own = declaration({
      id: 11,
      status: 'FROM_HOME',
      fromDate: '2026-11-05',
      toDate: '2026-11-05',
    });
    const [entry] = replacedAnnouncements(
      [own],
      { fromDate: '2026-11-05', toDate: '2026-11-05' },
      new Map()
    );
    expect(entry).toMatchObject({ statusId: 11, status: 'FROM_HOME', sourceMessageKey: null });
  });
});
