export type StatusType =
  | 'IN_OFFICE'
  | 'FROM_HOME'
  | 'AT_CLIENT'
  | 'SICK'
  | 'IN_LATE'
  | 'LEAVING_EARLY'
  | 'VACATION'
  | 'CHILD_SICK'
  | 'ON_LEAVE';

export type StatusProps = {
  status: StatusType;
  asLabel?: boolean;
};

export function Status({ status, asLabel = true }: StatusProps) {
  // Map status types to display messages and colors
  const statusConfig: Record<StatusType, { message: string; color: string }> = {
    IN_OFFICE: { message: 'In office', color: 'bg-light-blue' },
    FROM_HOME: { message: 'From home', color: 'bg-light-blue' },
    AT_CLIENT: { message: 'At client', color: 'bg-light-blue' },
    SICK: { message: 'Sick', color: 'bg-light-red' },
    IN_LATE: { message: 'In late', color: 'bg-light-yellow' },
    LEAVING_EARLY: { message: 'Leaving early', color: 'bg-light-yellow' },
    VACATION: { message: 'Vacation', color: 'bg-light-red' },
    CHILD_SICK: { message: 'Child sick', color: 'bg-light-red' },
    ON_LEAVE: { message: 'On leave', color: 'bg-light-red' },
  };

  const { message, color } = statusConfig[status];

  return (
    <>
      {asLabel ? (
        <div className={`w-fit px-1.5 py-0.5 ${color} rounded-md`} role="status">
          <p className="text-sm font-mono">{message}</p>
        </div>
      ) : (
        <p className={'font-mono md:'} role={'status'}>
          {message}
        </p>
      )}
    </>
  );
}
