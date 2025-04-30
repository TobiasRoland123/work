export type StatusType = 'in office' | 'from home' | 'at client' | 'sick' | 'vacation';

export type StatusProps = {
  status: StatusType;
};

export function Status({ status }: StatusProps) {
  // Map status types to display messages and colors
  const statusConfig: Record<StatusType, { message: string; color: string }> = {
    'in office': { message: 'In office', color: 'bg-light-blue' },
    'from home': { message: 'From home', color: 'bg-light-blue' },
    'at client': { message: 'At client', color: 'bg-light-blue' },
    sick: { message: 'Sick', color: 'bg-light-red' },
    vacation: { message: 'Vacation', color: 'bg-light-red' },
  };

  const { message, color } = statusConfig[status];

  return (
    <div className={`w-fit px-1.5 py-0.5 ${color} rounded-md`} role="status">
      <p className="text-sm font-mono">{message}</p>
    </div>
  );
}
