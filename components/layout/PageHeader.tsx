import { StatusButton } from './StatusButton';

export function PageHeader({
  title,
  subtitle,
  userId,
  dateLabel,
  onStatusSaved,
}: {
  title: string;
  subtitle: string;
  userId?: string;
  dateLabel?: string;
  onStatusSaved?: () => void;
}) {
  return (
    <header className="office-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="office-header-actions">
        {dateLabel && <time>{dateLabel}</time>}
        {userId && <StatusButton userId={userId} onSaved={onStatusSaved} />}
      </div>
    </header>
  );
}
