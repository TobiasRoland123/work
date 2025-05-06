import * as React from 'react';
import { Button } from '@/components/ui/Button/Button';
import {
  InsetSheet,
  InsetSheetClose,
  InsetSheetContent,
  InsetSheetDescription,
  InsetSheetFooter,
  InsetSheetHeader,
  InsetSheetTitle,
  InsetSheetWrapper,
} from '../Inset-Sheet/inset-sheet';

type StatusSidebarProps = {
  open: string;
  setOpen: (value: string) => void;
};

export function StatusSidebar({ open, setOpen }: StatusSidebarProps) {
  return (
    <InsetSheet
      open={open === 'status'}
      onOpenChange={(isOpen) => setOpen(isOpen ? 'status' : 'navigation')}
      side="right" // Explicitly set side if needed
    >
      {/* Add the wrapper to create space for content */}
      <InsetSheetWrapper>
        {/* Your main content goes here */}
        <div className="min-h-screen">{/* This content will be pushed to the side */}</div>
      </InsetSheetWrapper>

      <InsetSheetContent className={'bg-black py-7 px-3.5 border-0'} hideCloseButton>
        <InsetSheetHeader className={'flex flex-row justify-between p-0'}>
          <InsetSheetTitle className={'text-white font-mono font-light'}>
            Are you absolutely sure?
          </InsetSheetTitle>
          <InsetSheetClose>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
              {/* SVG content */}
            </svg>
          </InsetSheetClose>
        </InsetSheetHeader>
        <InsetSheetDescription className={'pt-14'}>
          TODO: Add confirmation details for the account deletion process here.
        </InsetSheetDescription>
        <InsetSheetFooter>
          <Button variant={'large'}>Register</Button>
        </InsetSheetFooter>
      </InsetSheetContent>
    </InsetSheet>
  );
}
