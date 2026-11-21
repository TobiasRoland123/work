import { describe, expect, it } from 'vitest';
import { costProjection } from '@/lib/slack/history/report';

describe('historical sample cost projection', () => {
  it('does not invent an estimate before processing a sample', () => {
    const report = costProjection(
      [{ month: '2026-01', total: 20, processed: 0, pending: 20, reservedUsd: 0 }],
      5,
      0
    );
    expect(report.months[0].estimatedTotalUsd).toBeNull();
    expect(report.remainingBudgetUsd).toBe(5);
  });
  it('projects only fetched remaining messages and keeps monthly spending separate', () => {
    const report = costProjection(
      [
        { month: '2026-01', total: 100, processed: 10, pending: 90, reservedUsd: 0.5 },
        { month: '2026-02', total: 5, processed: 5, pending: 0, reservedUsd: 0.2 },
      ],
      1,
      0.7
    );
    expect(report.months[0].estimatedAdditionalUsd).toBe(4.5);
    expect(report.months[0].estimatedTotalUsd).toBe(5);
    expect(report.months[1].estimatedTotalUsd).toBe(0.2);
    expect(report.remainingBudgetUsd).toBeCloseTo(0.3);
  });
});
