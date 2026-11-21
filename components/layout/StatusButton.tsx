'use client';

import { useStatusWritesEnabled } from '@/components/layout/StatusWriteAvailability';
import { IMPORT_STATUS_UNAVAILABLE } from '@/lib/slack/import-mode';

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
  const enabled = useStatusWritesEnabled();
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
          <button
            disabled={!enabled}
            title={!enabled ? IMPORT_STATUS_UNAVAILABLE : undefined}
            className="set-status-fab"
          >
            <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
            Set my status
          </button>
        ) : (
          <button
            disabled={!enabled}
            title={!enabled ? IMPORT_STATUS_UNAVAILABLE : undefined}
            className="set-status-button"
          >
            Set my status
          </button>
        )
      }
    />
  );
}
