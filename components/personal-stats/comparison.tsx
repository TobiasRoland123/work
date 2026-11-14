import React from 'react';
import type { ComparisonReason } from '@/lib/personal-stats/types';

export const percent = (value: number | null) =>
  value === null ? 'N/A' : `${Math.round(value * 100)}%`;

export function comparisonExplanation(reason: ComparisonReason): string {
  if (reason === 'small-cohort')
    return 'Hidden to protect privacy: fewer than 4 other employees have recorded working days.';
  if (reason === 'low-coverage')
    return 'Hidden because your recorded coverage or company recorded coverage is below 80%.';
  if (reason === 'no-working-days')
    return 'Unavailable because there are no recorded working days to compare.';
  if (reason === 'off') return 'Company comparison is off.';
  return 'Company average is available.';
}

export function ComparisonValue({
  share,
  reason,
}: {
  share: number | null;
  reason: ComparisonReason;
}) {
  return share === null ? (
    <details className="personal-reason">
      <summary>
        Hidden<span className="sr-only">. Show reason for unavailable company average</span>
      </summary>
      <p>{comparisonExplanation(reason)}</p>
    </details>
  ) : (
    <>{percent(share)}</>
  );
}
