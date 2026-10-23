import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function AiCostLoading() {
  return (
    <main id="dashboard-main" className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="AI cost"
        subtitle="Reported AI charges for interpreting Slack messages"
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading AI costs…</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}
