'use client';

import { useState } from 'react';
import { StatusDialog } from './StatusDialog';

export function StatusButton({
  userId,
  onSaved,
  weekStart,
}: {
  userId: string;
  onSaved?: () => void;
  weekStart?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <StatusDialog
      userId={userId}
      open={open}
      onOpenChange={setOpen}
      onSaved={onSaved}
      weekStart={weekStart}
      trigger={<button className="set-status-button">Set my status</button>}
    />
  );
}
