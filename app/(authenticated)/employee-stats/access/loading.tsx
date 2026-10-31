import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeStatsAccessLoading() {
  return (
    <main id="dashboard-main" className="content-page" aria-busy="true">
      <PageHeaderSkeleton title="Stats access" subtitle="Choose who can view the employee stats" />
      <div className="content-page-body space-y-6">
        <p role="status">Loading people…</p>
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}
