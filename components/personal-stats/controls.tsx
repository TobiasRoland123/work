'use client';

import { NativeSelect } from '@/components/ui/native-select';
import React from 'react';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { personalStatsUrl } from './urls';
import { PERSONAL_STATS_PERIODS, type PersonalStatsRange } from '@/lib/personal-stats/types';

export function ReportingPeriod({
  range,
  comparison,
}: {
  range: PersonalStatsRange;
  comparison: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="personal-period">
      Reporting period
      <NativeSelect
        aria-label="Reporting period"
        value={range}
        disabled={pending}
        onChange={(event) => {
          const selected = Number(event.target.value) as PersonalStatsRange;
          startTransition(() =>
            router.push(personalStatsUrl(selected, comparison), { scroll: false })
          );
        }}
      >
        {PERSONAL_STATS_PERIODS.map((days) => (
          <option value={days} key={days}>
            Last {days} days
          </option>
        ))}
      </NativeSelect>
      <span className="sr-only" role="status">
        {pending ? 'Updating reporting period' : ''}
      </span>
    </label>
  );
}

export function CompanyComparison({
  range,
  comparison,
}: {
  range: PersonalStatsRange;
  comparison: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="personal-comparison-toggle"
      type="button"
      role="switch"
      aria-checked={comparison}
      disabled={pending}
      onClick={() =>
        startTransition(() => router.push(personalStatsUrl(range, !comparison), { scroll: false }))
      }
    >
      <span className="personal-switch-track" aria-hidden="true">
        <span />
      </span>
      Company average
      <span className="sr-only" role="status">
        {pending ? 'Updating company comparison' : ''}
      </span>
    </button>
  );
}
