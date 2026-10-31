import React from 'react';
import Link from 'next/link';
import { RANGE_NAMES } from '@/lib/employee-stats/format';
import { EMPLOYEE_STATS_RANGES } from '@/lib/employee-stats/stats';
import type { EmployeeStatsRange } from '@/lib/employee-stats/stats';

export function StatsTabs({ current }: { current: 'overview' | 'employees' }) {
  return (
    <nav aria-label="Stats sections" className="stats-tabs">
      <Link href="/employee-stats" aria-current={current === 'overview' ? 'page' : undefined}>
        Overview
      </Link>
      <Link
        href="/employee-stats/people"
        aria-current={current === 'employees' ? 'page' : undefined}
      >
        Employees
      </Link>
    </nav>
  );
}

export function RangeNav({
  current,
  href,
}: {
  current: EmployeeStatsRange;
  href: (range: EmployeeStatsRange) => string;
}) {
  return (
    <nav aria-label="Period" className="stats-periods">
      {EMPLOYEE_STATS_RANGES.map((range) => (
        <Link key={range} href={href(range)} aria-current={range === current ? 'page' : undefined}>
          {RANGE_NAMES[String(range)]}
        </Link>
      ))}
    </nav>
  );
}
