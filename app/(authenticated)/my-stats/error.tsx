'use client';

import React from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import '@/components/personal-stats/personal-stats.css';

export default function MyStatsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="dashboard-main" className="content-page personal-stats-page">
      <PageHeader
        title="Attendance trends"
        subtitle="See how your office routine changes over time."
      />
      <div className="content-page-body personal-stats-body">
        <section className="personal-card personal-error" role="alert">
          <h2>Your attendance trends could not load</h2>
          <p>Try again to load your recorded attendance for this period.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </section>
      </div>
    </main>
  );
}
