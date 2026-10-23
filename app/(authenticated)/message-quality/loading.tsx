import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function MessageQualityLoading() {
  return (
    <main id="dashboard-main" className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="Message quality"
        subtitle="Accepted Slack messages and saved status outcomes"
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading message quality…</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}
