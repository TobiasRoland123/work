import { describe, expect, it } from 'vitest';
import { formatDateRange } from '@/utils/FormatDate';

describe('formatDateRange', () => {
  it('returns null when fromDate or toDate is missing or identical', () => {
    expect(formatDateRange(null, null)).toBeNull();
    expect(formatDateRange('2026-09-19', null)).toBeNull();
    expect(formatDateRange(null, '2026-09-20')).toBeNull();
    expect(formatDateRange('2026-09-19', '2026-09-19')).toBeNull();
  });

  it('removes the year when start and end share the same year', () => {
    expect(formatDateRange('2026-09-19', '2026-09-20')).toBe('19.09-20.09');
    expect(formatDateRange('2026-01-05', '2026-01-10')).toBe('05.01-10.01');
    expect(formatDateRange('2026-03-31', '2026-04-02')).toBe('31.03-02.04');
  });

  it('preserves both years when start and end span different years', () => {
    expect(formatDateRange('2026-12-30', '2027-01-03')).toBe('30.12.2026-03.01.2027');
    expect(formatDateRange('2025-11-20', '2026-02-15')).toBe('20.11.2025-15.02.2026');
  });
});
