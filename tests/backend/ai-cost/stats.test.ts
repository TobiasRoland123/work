import { describe, expect, it } from 'vitest';
import {
  addAiUsage,
  aiCostPeriod,
  aiUsageFromRow,
  averageCostPerPricedCall,
  calendarMonths,
  emptyAiUsage,
  periodDays,
} from '@/lib/ai-cost/stats';

describe('AI cost periods', () => {
  it('accepts only the offered periods and defaults to 30 days', () => {
    expect(aiCostPeriod('7')).toBe(7);
    expect(aiCostPeriod('90')).toBe(90);
    expect(aiCostPeriod(undefined)).toBe(30);
    expect(aiCostPeriod('365')).toBe(30);
    expect(aiCostPeriod(['7'])).toBe(30);
  });

  it('ends on the current Copenhagen day', () => {
    expect(periodDays(3, new Date('2026-10-15T22:30:00Z'))).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
    expect(periodDays(7, new Date('2026-03-01T10:00:00Z'))[0]).toBe('2026-02-23');
  });

  it('finds the current and previous month across a year boundary', () => {
    expect(calendarMonths(new Date('2026-12-31T23:30:00Z'))).toEqual({
      today: '2027-01-01',
      current: '2027-01-01',
      previous: '2026-12-01',
    });
  });
});

describe('AI usage totals', () => {
  it('keeps the total unknown until any call reports a cost', () => {
    const unpriced = aiUsageFromRow({
      costUsd: null,
      calls: 2,
      unpricedCalls: 2,
      failedCalls: 1,
      inputTokens: null,
      outputTokens: null,
    });
    expect(addAiUsage(emptyAiUsage(), unpriced).costUsd).toBeNull();
    const priced = aiUsageFromRow({
      costUsd: '0.003',
      calls: 3,
      unpricedCalls: 0,
      failedCalls: 0,
      inputTokens: '1200',
      outputTokens: '90',
    });
    expect(addAiUsage(unpriced, priced)).toEqual({
      costUsd: 0.003,
      calls: 5,
      unpricedCalls: 2,
      failedCalls: 1,
      inputTokens: 1200,
      outputTokens: 90,
    });
  });

  it('averages over priced calls only', () => {
    const usage = { ...emptyAiUsage(), costUsd: 0.003, calls: 5, unpricedCalls: 2 };
    expect(averageCostPerPricedCall(usage)).toBeCloseTo(0.001);
    expect(averageCostPerPricedCall({ ...usage, costUsd: null })).toBeNull();
    expect(averageCostPerPricedCall(emptyAiUsage())).toBeNull();
  });
});
