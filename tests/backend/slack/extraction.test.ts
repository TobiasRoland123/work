import { describe, expect, it } from 'vitest';
import {
  copenhagenDate,
  localInstant,
  statusRows,
  validateExtraction,
} from '@/lib/slack/extraction';

const sent = new Date('2026-09-07T07:30:00Z');
const interval: {
  status: string;
  fromDate: string;
  toDate: string;
  startTime: string | null;
  endTime: string | null;
  startApproximate: boolean;
  endApproximate: boolean;
  comment: string | null;
} = {
  status: 'FROM_HOME',
  fromDate: '2026-09-07',
  toDate: '2026-09-07',
  startTime: null,
  endTime: null,
  startApproximate: false,
  endApproximate: false,
  comment: null,
};
const extract = (intervals = [interval]) => ({ decision: 'apply', reason: 'clear', intervals });

describe('attendance extraction boundary', () => {
  it('uses Copenhagen day across UTC midnight', () => {
    expect(copenhagenDate(new Date('2026-09-06T23:30:00Z'))).toBe('2026-09-07');
  });
  it('represents WFH dates without manufacturing action times or retaining reasons', () => {
    const [row] = statusRows(validateExtraction(extract(), sent));
    expect(row.time).toBeNull();
    expect(row.details).toBeNull();
    expect(row.startsAt.toISOString()).toBe('2026-09-06T22:00:00.000Z');
    expect(row.endsAt.toISOString()).toBe('2026-09-07T22:00:00.000Z');
  });
  it('keeps multi-day final dates inclusive through the last evening', () => {
    const [row] = statusRows(
      validateExtraction(extract([{ ...interval, toDate: '2026-09-11' }]), sent)
    );
    expect(row.endsAt.toISOString()).toBe('2026-09-11T22:00:00.000Z');
  });
  it('supports precise arrival, departure and return intervals', () => {
    const parsed = validateExtraction(
      extract([
        { ...interval, status: 'IN_LATE', endTime: '10:00' } as typeof interval,
        {
          ...interval,
          status: 'IN_OFFICE',
          startTime: '10:00',
          endTime: '13:00',
        } as typeof interval,
        { ...interval, status: 'AWAY', startTime: '13:00', endTime: '14:00' } as typeof interval,
        { ...interval, status: 'IN_OFFICE', startTime: '14:00' } as typeof interval,
      ]),
      sent
    );
    const rows = statusRows(parsed);
    expect(rows[0].endsAt.toISOString()).toBe('2026-09-07T08:00:00.000Z');
    expect(rows[2].endsAt.getTime()).toBe(rows[3].startsAt.getTime());
  });
  it('preserves unspecified arrival time', () => {
    const [row] = statusRows(
      validateExtraction(extract([{ ...interval, status: 'IN_LATE' }]), sent)
    );
    expect(row.time).toBeNull();
    expect(row.details).toBe('Arrival time unspecified');
  });
  it.each([
    { ...interval, fromDate: '2026-02-30' },
    { ...interval, toDate: '2026-09-06' },
    { ...interval, startTime: '14:00', endTime: '13:00' },
    { ...interval, startTime: '25:00' },
    { ...interval, fromDate: '2028-01-01', toDate: '2028-01-02' },
    { ...interval, toDate: '2026-09-08', startTime: '14:00' },
  ])('rejects malformed or unsupported date/time output', (bad) => {
    expect(() => validateExtraction(extract([bad as typeof interval]), sent)).toThrow();
  });
  it('rejects invented free-text fields and overlapping intervals', () => {
    expect(() =>
      validateExtraction(
        extract([{ ...interval, reason: 'private diagnosis' } as typeof interval]),
        sent
      )
    ).toThrow();
    expect(() => validateExtraction(extract([interval, interval]), sent)).toThrow();
  });
  it('cannot apply uncertain output', () => {
    expect(() => validateExtraction({ ...extract(), decision: 'review' }, sent)).toThrow();
    expect(
      validateExtraction({ decision: 'review', reason: 'uncertain_date', intervals: [] }, sent)
        .intervals
    ).toEqual([]);
  });
  it('rejects repeated/nonexistent Danish daylight-saving clock times', () => {
    expect(() => localInstant('2026-03-29', '02:30')).toThrow();
    expect(() => localInstant('2026-10-25', '02:30')).toThrow();
    expect(localInstant('2026-03-29', '03:30').toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });
});

it('preserves approximate nominal arrival without turning it into definite office presence', () => {
  const parsed = validateExtraction(
    extract([
      { ...interval, status: 'IN_LATE', endTime: '10:00', endApproximate: true } as typeof interval,
    ]),
    sent
  );
  const [row] = statusRows(parsed);
  expect(row.endsAtApproximate).toBe(true);
  expect(row.endsAt.toISOString()).toBe('2026-09-07T08:00:00.000Z');
  expect(() =>
    validateExtraction(
      extract([
        {
          ...interval,
          status: 'IN_OFFICE',
          startTime: '10:00',
          startApproximate: true,
        } as typeof interval,
      ]),
      sent
    )
  ).toThrow();
});
