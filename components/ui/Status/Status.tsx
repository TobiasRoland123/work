import { StatusEmoji } from './StatusEmoji';
import { AIIndicator } from './AIIndicator';

export type StatusType =
  | 'IN_OFFICE'
  | 'FROM_HOME'
  | 'REMOTE'
  | 'AT_CLIENT'
  | 'SICK'
  | 'IN_LATE'
  | 'LEAVING_EARLY'
  | 'VACATION'
  | 'CHILD_SICK'
  | 'ON_LEAVE'
  | 'AWAY';

export type StatusProps = {
  status: StatusType | null;
  asLabel?: boolean;
  sourceMessageKey?: string | null;
  emoji?: string | null;
  details?: string | null;
  children?: React.ReactNode;
};

export function Status({
  status,
  asLabel = true,
  children,
  emoji,
  details,
  sourceMessageKey,
}: StatusProps) {
  if (status === null) return null;

  // Map status types to display messages and colors
  const statusConfig: Record<StatusType, { message: string; color: string }> = {
    IN_OFFICE: { message: 'In office', color: 'bg-light-blue' },
    FROM_HOME: { message: 'From home', color: 'bg-light-blue' },
    REMOTE: { message: 'Remote', color: 'bg-light-blue' },
    AT_CLIENT: { message: 'At client', color: 'bg-light-blue' },
    SICK: { message: 'Sick', color: 'bg-light-red' },
    IN_LATE: { message: 'In late', color: 'bg-light-mud  ' },
    LEAVING_EARLY: { message: 'Leaving early', color: 'bg-light-mud  ' },
    VACATION: { message: 'Vacation', color: 'bg-light-red' },
    CHILD_SICK: { message: 'Child sick', color: 'bg-light-red' },
    ON_LEAVE: { message: 'On leave', color: 'bg-light-red' },
    AWAY: { message: 'Temporarily away', color: 'bg-light-mud' },
  };

  const { message, color } = statusConfig[status];

  return (
    <>
      {asLabel ? (
        <div
          className={`relative w-fit px-1.5 py-0.5 h-fit text-nowrap text-[#0b1014] ${color} rounded-md${sourceMessageKey ? ' pr-5' : ''}`}
          role="status"
        >
          <p className="text-sm font-mono">
            {children ? (
              children
            ) : (
              <>
                <StatusEmoji status={status} emoji={emoji} details={details} />
                {message}
              </>
            )}
          </p>
          <AIIndicator sourceMessageKey={sourceMessageKey} position="corner" />
        </div>
      ) : (
        <p className={'font-mono h-fit'} role={'status'}>
          {children ? (
            children
          ) : (
            <>
              <StatusEmoji status={status} emoji={emoji} details={details} />
              {message}
            </>
          )}
          <AIIndicator sourceMessageKey={sourceMessageKey} />
        </p>
      )}
    </>
  );
}
