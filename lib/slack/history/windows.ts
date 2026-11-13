import { localInstant } from '../extraction';

export const PARSER_VERSION = 'history-2026-v1';
export type MonthWindow = { month: string; oldest: string; latest: string };
export function timestamp(instant: Date): string {
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid instant');
  return (instant.getTime() / 1000).toFixed(6);
}
export function compareTs(a: string, b: string): number {
  if (!/^\d+\.\d{6}$/.test(a) || !/^\d+\.\d{6}$/.test(b))
    throw new Error('Invalid Slack timestamp');
  const left = BigInt(a.replace('.', ''));
  const right = BigInt(b.replace('.', ''));
  return left < right ? -1 : left > right ? 1 : 0;
}
export function monthlyWindows(cutoff: string): MonthWindow[] {
  const end = new Date(cutoff);
  const start = localInstant('2026-01-01', '00:00');
  if (!Number.isFinite(end.getTime()) || end <= start || end > new Date())
    throw new Error('Cutoff must be after January 1, 2026 and not in the future');
  const result: MonthWindow[] = [];
  for (let year = 2026, month = 1; ; ) {
    const label = `${year}-${String(month).padStart(2, '0')}`;
    const first = localInstant(`${label}-01`, '00:00');
    if (++month > 12) {
      month = 1;
      year++;
    }
    const next = localInstant(`${year}-${String(month).padStart(2, '0')}-01`, '00:00');
    result.push({
      month: label,
      oldest: timestamp(first),
      latest: timestamp(next < end ? next : end),
    });
    if (next >= end) return result;
  }
}
