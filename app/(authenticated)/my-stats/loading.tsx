import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import '@/components/personal-stats/personal-stats.css';

export default function MyStatsLoading() {
  return (
    <main id="dashboard-main" className="content-page personal-stats-page" aria-busy="true">
      <PageHeader
        title="Attendance trends"
        subtitle="See how your office routine changes over time."
      />
      <div className="content-page-body personal-stats-body">
        <p role="status">Loading your attendance trends…</p>
        <div className="personal-stats-summary">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-36 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-md" />
        <Skeleton className="h-60 rounded-md" />
      </div>
    </main>
  );
}
