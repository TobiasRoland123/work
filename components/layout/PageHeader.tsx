import type { ReactNode } from 'react';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { StatusButton } from './StatusButton';
import { ThemeToggle } from './ThemeToggle';

export function PageHeader({
  title,
  subtitle,
  userId,
  dateLabel,
  actions,
  statusWeekStart,
  onStatusSaved,
}: {
  title: string;
  subtitle: string;
  userId?: string;
  dateLabel?: string;
  actions?: ReactNode;
  /** First week offered when planning a status from this page. */
  statusWeekStart?: string;
  onStatusSaved?: () => void;
}) {
  return (
    <header className="office-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="office-header-actions">
        {actions}
        {dateLabel && <time>{dateLabel}</time>}
        <ThemeToggle />
        {userId && (
          <StatusButton userId={userId} onSaved={onStatusSaved} weekStart={statusWeekStart} />
        )}
      </div>
    </header>
  );
}

/** Loading version of PageHeader. Title and subtitle show real text when they are known up front. */
export function PageHeaderSkeleton({
  title,
  subtitle,
  actions,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="office-header">
      <div className="min-w-0">
        <h1>{title ?? <SkeletonText className="w-44" />}</h1>
        <p>{subtitle ?? <SkeletonText className="w-64" />}</p>
      </div>
      <div className="office-header-actions">
        {actions}
        <ThemeToggle />
        <Skeleton className="h-[45px] w-[116px] rounded-[5px]" />
      </div>
    </header>
  );
}
