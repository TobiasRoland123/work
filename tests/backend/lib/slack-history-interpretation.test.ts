import { describe, expect, it } from 'vitest';
import { historicalReviewReason } from '@/lib/slack/history/interpretation';
import type { Extraction } from '@/lib/slack/extraction';

const home: Extraction['intervals'][number] = {
  status: 'FROM_HOME',
  fromDate: '2026-01-12',
  toDate: '2026-01-12',
  startTime: null,
  endTime: null,
  startApproximate: false,
  endApproximate: false,
  comment: null,
};

describe('historical home attendance', () => {
  it.each(['Working from home until I come in later', 'Starter hjemme og kommer ind senere'])(
    'holds an unspecified boundary in %s',
    (source) => {
      expect(historicalReviewReason(source, [home])).toBe(
        'partial_day_home_boundary_requires_review'
      );
      expect(historicalReviewReason(source, [{ ...home, endTime: '10:00' }])).toBe(
        'partial_day_home_boundary_requires_review'
      );
    }
  );
  it.each(['WFH today', 'Arbejder hjemme i dag'])('keeps the full date for %s', (source) => {
    expect(historicalReviewReason(source, [home])).toBeNull();
  });
  it.each(['WFH until 10:30, then in the office', 'Hjemme indtil kl. 10.30, derefter på kontoret'])(
    'keeps a stated transition in %s',
    (source) => {
      expect(
        historicalReviewReason(source, [
          { ...home, endTime: '10:30' },
          { ...home, status: 'IN_OFFICE', startTime: '10:30' },
        ])
      ).toBeNull();
    }
  );
});

describe('historical clock evidence', () => {
  it.each([
    ['WFH until 2:30 pm, then office', '14:30', true],
    ['WFH until 12 am', '00:00', true],
    ['WFH until 2 pm', '02:00', false],
    ['WFH until I come in later. Appointment until 10', '10:00', false],
    ['Not WFH until 10', '10:00', false],
    ['Ikke hjemme indtil kl. 10', '10:00', false],
  ] as const)('checks the clock attached to home work in %s', (source, endTime, approved) => {
    expect(historicalReviewReason(source, [{ ...home, endTime }]) === null).toBe(approved);
  });
  it('holds a return to the office absent from the source', () => {
    expect(
      historicalReviewReason('WFH until 10', [
        { ...home, endTime: '10:00' },
        { ...home, status: 'IN_OFFICE', startTime: '10:00' },
      ])
    ).toBeTruthy();
  });
  it.each(['Office until 12, then WFH', 'På kontoret indtil kl. 12, derefter hjemme'])(
    'keeps an explicit transition to home in %s',
    (source) => {
      expect(
        historicalReviewReason(source, [
          { ...home, status: 'IN_OFFICE', endTime: '12:00' },
          { ...home, startTime: '12:00' },
        ])
      ).toBeNull();
    }
  );
});
