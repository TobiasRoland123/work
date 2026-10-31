import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { isEmployeeStatsAdmin, requireEmployeeStatsViewer } from '@/lib/auth/employee-stats';
import { listEmployees } from '@/lib/employee-stats/service';
import { PersonSearch } from '../PersonSearch';
import { StatsTabs } from '../controls';
import '../employee-stats.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ q?: string | string[] }>;

export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const userId = await requirePageUserId();
  await requireEmployeeStatsViewer();
  const { q } = await searchParams;
  const [people, isAdmin] = await Promise.all([listEmployees(), isEmployeeStatsAdmin(userId)]);

  return (
    <main id="dashboard-main" className="content-page stats-page">
      <PageHeader
        title="Employee stats"
        subtitle="Search an employee to see their own stats"
        actions={
          isAdmin ? (
            <Link href="/employee-stats/access" className="stats-header-link">
              Manage access
            </Link>
          ) : undefined
        }
      />
      <div className="content-page-body stats-body">
        <StatsTabs current="employees" />
        <section className="stats-section stats-panel" aria-labelledby="stats-find-heading">
          <h2 id="stats-find-heading">Find an employee</h2>
          <p className="stats-muted">
            Open someone to see their attendance over time, on its own or against the norm made of
            their colleagues.
          </p>
          <PersonSearch people={people} initialQuery={typeof q === 'string' ? q : ''} />
        </section>
      </div>
    </main>
  );
}
