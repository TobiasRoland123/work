import type { ReactNode } from 'react';
import { StatusButton } from './StatusButton';

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
        {userId && (
          <StatusButton userId={userId} onSaved={onStatusSaved} weekStart={statusWeekStart} />
        )}
      </div>
    </header>
  );
}
