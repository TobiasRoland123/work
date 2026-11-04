'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { StatusDialog } from './StatusDialog';

export function StatusButton({
  userId,
  onSaved,
  weekStart,
  floating = false,
}: {
  userId: string;
  onSaved?: () => void;
  weekStart?: string;
  /** The floating action button pages show on phones instead of the header button. */
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <StatusDialog
      userId={userId}
      open={open}
      onOpenChange={setOpen}
      onSaved={onSaved}
      weekStart={weekStart}
      trigger={
        floating ? (
          <button className="set-status-fab">
            <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
            Set my status
          </button>
        ) : (
          <button className="set-status-button">Set my status</button>
        )
      }
    />
  );
}
