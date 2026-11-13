'use client';

import { useStatusWritesEnabled } from '@/components/layout/StatusWriteAvailability';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { StatusForm } from '@/components/StatusForm/StatusForm';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export type StatusDialogProps = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  /** Days to preselect in the planner. */
  initialDays?: string[];
  /** First week offered in the planner. */
  weekStart?: string;
  trigger?: ReactElement;
  /** Set when an admin sets the status on behalf of this colleague. */
  colleague?: { userId: string; name: string };
};

/** Same breakpoint as the phone layout in shell.css. */
const PHONE_QUERY = '(max-width: 760px)';

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
  const enabled = useStatusWritesEnabled();
  const router = useRouter();
  const [step, setStep] = useState(1);
  // Phones get a bottom sheet with a swipe handle, larger screens a panel sliding in from the right.
  const isPhone = useMediaQuery(PHONE_QUERY);
  return (
    <Drawer
      open={open && enabled}
      onOpenChange={(value) => onOpenChange(value && enabled)}
      // Reset the step once the close animation has finished, so the sheet doesn't jump mid-slide.
      onOpenChangeComplete={(isOpen) => !isOpen && setStep(1)}
      swipeDirection={isPhone ? 'down' : 'right'}
      showSwipeHandle={isPhone}
    >
      {trigger && <DrawerTrigger disabled={!enabled} render={trigger} />}
      <DrawerContent className="office-status-dialog" overlayClassName="office-drawer-overlay">
        <div className="office-status-dialog-scroll">
          <DrawerTitle className="sr-only">
            {colleague ? `Set status for ${colleague.name}` : 'Set my status'}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {colleague
              ? `Tell colleagues where ${colleague.name} will be working, today or on days ahead.`
              : 'Tell your colleagues where you will be working, today or on days ahead.'}
          </DrawerDescription>
          <StatusForm
            userId={userId}
            currentStep={step}
            setCurrentStep={setStep}
            initialDays={initialDays}
            weekStart={weekStart}
            colleague={colleague}
            onSaved={() => {
              onOpenChange(false);
              onSaved?.();
              router.refresh();
            }}
            closeButton={
              <DrawerClose className="status-form-close" aria-label="Close status form">
                <X size={20} />
              </DrawerClose>
            }
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
