'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { StatusForm } from '@/components/StatusForm/StatusForm';

export type StatusDialogProps = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  /** Days to preselect in the planner. */
  initialDays?: string[];
  /** First week offered in the planner. */
  weekStart?: string;
  trigger?: ReactNode;
  /** Set when an admin sets the status on behalf of this colleague. */
  colleague?: { userId: string; name: string };
};

export function StatusDialog({
  userId,
  open,
  onOpenChange,
  onSaved,
  initialDays,
  weekStart,
  trigger,
  colleague,
}: StatusDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  function changeOpen(value: boolean) {
    onOpenChange(value);
    setStep(1);
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="office-dialog-overlay" />
        <Dialog.Content className="office-status-dialog">
          <Dialog.Title className="sr-only">
            {colleague ? `Set status for ${colleague.name}` : 'Set my status'}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {colleague
              ? `Tell colleagues where ${colleague.name} will be working, today or on days ahead.`
              : 'Tell your colleagues where you will be working, today or on days ahead.'}
          </Dialog.Description>
          <StatusForm
            key={open ? 'open' : 'closed'}
            userId={userId}
            currentStep={step}
            setCurrentStep={setStep}
            initialDays={initialDays}
            weekStart={weekStart}
            colleague={colleague}
            onSaved={() => {
              changeOpen(false);
              onSaved?.();
              router.refresh();
            }}
            closeButton={
              <Dialog.Close className="status-form-close" aria-label="Close status form">
                <X size={20} />
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
