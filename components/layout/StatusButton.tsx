'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { StatusForm } from '@/components/StatusForm/StatusForm';

export function StatusButton({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  function changeOpen(value: boolean) {
    setOpen(value);
    setStep(1);
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button className="set-status-button">Set my status</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="office-dialog-overlay" />
        <Dialog.Content className="office-status-dialog">
          <Dialog.Title className="sr-only">Set my status</Dialog.Title>
          <Dialog.Description className="sr-only">
            Tell your colleagues where you are working today.
          </Dialog.Description>
          <StatusForm
            key={open ? 'open' : 'closed'}
            userId={userId}
            currentStep={step}
            setCurrentStep={setStep}
            onSaved={() => {
              changeOpen(false);
              onSaved?.();
              router.refresh();
            }}
            closeButton={
              <Dialog.Close aria-label="Close status form">
                <X size={22} />
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
