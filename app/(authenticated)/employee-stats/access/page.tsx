import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { requireEmployeeStatsAdmin } from '@/lib/auth/employee-stats';
import { listEmployeeStatsAccess } from '@/lib/employee-stats/access';
import { AccessManager } from './AccessManager';
import '../employee-stats.css';

export const dynamic = 'force-dynamic';

export default async function EmployeeStatsAccessPage() {
  await requirePageUserId();
  const adminUserId = await requireEmployeeStatsAdmin();
  const entries = await listEmployeeStatsAccess();

  return (
    <main id="dashboard-main" className="content-page stats-page">
      <PageHeader
        title="Stats access"
        subtitle="Choose who can view the employee stats"
        actions={
          <Link href="/employee-stats" className="stats-header-link">
            View stats
          </Link>
        }
      />
      <div className="content-page-body stats-body">
        <AccessManager entries={entries} adminUserId={adminUserId} />
        <p className="stats-note">
          Only you can change this list. Access takes effect on the person’s next page load and
          stops as soon as you revoke it or they leave Slack. The stats include sick days, so grant
          access only to people who need it.
        </p>
      </div>
    </main>
  );
}
