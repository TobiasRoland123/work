import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeStatsLoading() {
  return (
    <main id="dashboard-main" className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="Employee stats"
        subtitle="Where people worked, based on announced and default attendance"
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading employee stats…</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}
