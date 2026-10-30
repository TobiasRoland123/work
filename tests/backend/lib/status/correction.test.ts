import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import {
  CorrectionError,
  importedRevision,
  isSuperseded,
  planCorrection,
} from '@/lib/status/correction';

const revision = '1790000000.123456';
const imported: Status = {
  id: 7,
  userID: 'person',
  status: 'FROM_HOME',
  details: 'hjemme resten af ugen',
  time: null,
  fromDate: '2026-09-21',
  toDate: '2026-09-23',
  sourceMessageKey: 'T:C:' + revision,
  startsAt: new Date('2026-09-20T22:00:00Z'),
  endsAt: new Date('2026-09-23T22:00:00Z'),
  startsAtApproximate: false,
  endsAtApproximate: false,
  announcedAt: new Date(Number(revision) * 1000),
  createdAt: new Date(Number(revision) * 1000).toISOString(),
};
const correct = (input: object, original: Status = imported) =>
  planCorrection(original, {
    statusId: original.id,
    day: '2026-09-22',
    scope: 'day',
    ...input,
  } as never);

describe('correcting an imported status', () => {
  it('replaces one day or the whole imported interval', () => {
    expect(correct({ status: 'AT_CLIENT' })).toEqual({
      status: 'AT_CLIENT',
      details: 'hjemme resten af ugen',
      fromDate: '2026-09-22',
      toDate: '2026-09-22',
      time: null,
    });
    expect(correct({ status: 'AT_CLIENT', scope: 'declaration' })).toMatchObject({
      fromDate: '2026-09-21',
      toDate: '2026-09-23',
    });
    expect(correct({ status: 'REMOTE' })).toEqual({
      status: 'REMOTE',
      details: 'hjemme resten af ugen',
      fromDate: '2026-09-22',
      toDate: '2026-09-22',
      time: null,
    });
  });

  it('drops notes that would mislead on the corrected status', () => {
    expect(correct({ status: 'SICK' }).details).toBeNull();
    expect(
      correct(
        { status: 'FROM_HOME' },
        { ...imported, status: 'IN_LATE', details: 'Arrival time unspecified' }
      ).details
    ).toBeNull();
  });

  it('lets a note saved without a status become a status', () => {
    expect(correct({ status: 'FROM_HOME' }, { ...imported, status: null }).status).toBe(
      'FROM_HOME'
    );
  });

  it('rejects manual statuses, days outside the import and unchanged statuses', () => {
    expect(() => correct({ status: 'SICK' }, { ...imported, sourceMessageKey: null })).toThrow(
      CorrectionError
    );
    expect(() => correct({ status: 'SICK', day: '2026-09-24' })).toThrow(
      'That day is not part of this Slack announcement.'
    );
    expect(() => correct({ status: 'FROM_HOME' })).toThrow(CorrectionError);
  });

  it('records the revision only when it wrote the imported Declaration', () => {
    expect(importedRevision(imported, { revision })).toBe(revision);
    expect(importedRevision(imported, { revision: '1790000300.000001' })).toBeNull();
    expect(importedRevision(imported, undefined)).toBeNull();
  });

  it('treats a correction as superseded only by a newer overlapping Declaration', () => {
    const correction = {
      ...imported,
      id: 8,
      sourceMessageKey: null,
      announcedAt: new Date('2026-10-01T10:00:00Z'),
    };
    const later = (fromDate: string) => ({
      ...correction,
      id: 9,
      fromDate,
      toDate: fromDate,
      announcedAt: new Date('2026-10-02T10:00:00Z'),
    });
    expect(isSuperseded(correction, [imported, correction], '2026-09-22', '2026-09-22')).toBe(
      false
    );
    expect(
      isSuperseded(correction, [correction, later('2026-09-29')], '2026-09-22', '2026-09-22')
    ).toBe(false);
    expect(
      isSuperseded(correction, [correction, later('2026-09-22')], '2026-09-22', '2026-09-22')
    ).toBe(true);
  });
});
