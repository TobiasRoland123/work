export const count = new Intl.NumberFormat('en-GB');

const oneDecimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

/** A share between 0 and 1 as a whole percentage, or N/A when there was nothing to divide. */
export function percent(value: number | null): string {
  return value === null ? 'N/A' : `${Math.round(value * 100)}%`;
}

export const share = (part: number, whole: number): number | null =>
  whole === 0 ? null : part / whole;

export const average = (total: number, days: number): string =>
  days === 0 ? 'N/A' : oneDecimal.format(total / days);

export function dayLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** The gap between two shares in percentage points, such as "+8 pts", or null if either is missing. */
export function pointGap(value: number | null, norm: number | null): string | null {
  if (value === null || norm === null) return null;
  const gap = Math.round(value * 100) - Math.round(norm * 100);
  if (gap === 0) return 'same as the norm';
  return `${gap > 0 ? '+' : '−'}${Math.abs(gap)} pts`;
}

export const RANGE_NAMES: Record<string, string> = {
  '7': '7 days',
  '30': '30 days',
  '90': '90 days',
  '180': '6 months',
  '365': '1 year',
  all: 'All time',
};

export const RANGE_HEADINGS: Record<string, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '180': 'Last 6 months',
  '365': 'Last year',
  all: 'All time',
};

export function fullDayLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}
