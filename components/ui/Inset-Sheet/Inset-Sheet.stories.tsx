import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { Button } from '../Button/Button';
import {
  InsetSheet,
  InsetSheetWrapper,
  InsetSheetTrigger,
  InsetSheetContent,
  InsetSheetHeader,
  InsetSheetTitle,
  InsetSheetDescription,
  InsetSheetFooter,
  InsetSheetClose,
} from './inset-sheet';

const meta = {
  component: InsetSheet,
  title: 'UI/InsetSheet',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InsetSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// Demo wrapper that includes all main parts of the InsetSheet
const InsetSheetDemo = ({
  side = 'right',
  hideCloseButton = false,
  children,
}: {
  side?: 'top' | 'right' | 'bottom' | 'left';
  hideCloseButton?: boolean;
  children?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <InsetSheet open={open} onOpenChange={setOpen} side={side}>
      <InsetSheetWrapper>
        <div className="p-6 min-h-screen space-y-4 border border-dashed border-gray-300 rounded-md">
          <h1 className="text-2xl font-bold">Main Content Area</h1>
          <p>
            This content will be pushed aside when the sheet is open. Try opening the sheet to see
            how this content adjusts.
          </p>
          <InsetSheetTrigger text="Open sheet" />
        </div>
      </InsetSheetWrapper>

      <InsetSheetContent hideCloseButton={hideCloseButton}>
        <InsetSheetHeader>
          <InsetSheetTitle>Sheet Title</InsetSheetTitle>
          <InsetSheetDescription>
            This is a description of what this sheet is for.
          </InsetSheetDescription>
        </InsetSheetHeader>

        {children}

        <InsetSheetFooter>
          <InsetSheetClose>Close</InsetSheetClose>
          <Button ariaLabel="Save Changes">Save Changes</Button>
        </InsetSheetFooter>
      </InsetSheetContent>
    </InsetSheet>
  );
};

export const Default: Story = {
  render: () => <InsetSheetDemo />,
};

export const FromTop: Story = {
  render: () => <InsetSheetDemo side="top" />,
};

export const FromBottom: Story = {
  render: () => <InsetSheetDemo side="bottom" />,
};

export const FromLeft: Story = {
  render: () => <InsetSheetDemo side="left" />,
};

export const NoCloseButton: Story = {
  render: () => <InsetSheetDemo hideCloseButton />,
};

export const WithForm: Story = {
  render: () => (
    <InsetSheetDemo>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" className="w-full p-2 border rounded" placeholder="Enter your name" />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full p-2 border rounded"
            placeholder="Enter your email"
          />
        </div>
      </div>
    </InsetSheetDemo>
  ),
};

export const CustomStyling: Story = {
  render: () => {
    const CustomStyledSheet = () => {
      const [open, setOpen] = useState(false);

      return (
        <InsetSheet open={open} onOpenChange={setOpen}>
          <InsetSheetWrapper>
            <div className="p-6 min-h-screen">
              <InsetSheetTrigger text="Open sheet" />
            </div>
          </InsetSheetWrapper>

          <InsetSheetContent className="bg-black text-white border-0">
            <InsetSheetHeader className="border-b border-gray-700">
              <InsetSheetTitle className="text-white">Custom Dark Sheet</InsetSheetTitle>
              <InsetSheetDescription className="text-gray-400">
                A custom styled dark sheet example
              </InsetSheetDescription>
            </InsetSheetHeader>

            <div className="p-4">
              <p>This sheet has custom styling applied.</p>
            </div>

            <InsetSheetFooter className="border-t border-gray-700">
              <InsetSheetClose>Close</InsetSheetClose>
            </InsetSheetFooter>
          </InsetSheetContent>
        </InsetSheet>
      );
    };
    return <CustomStyledSheet />;
  },
};

// Example with controlled state and programmatic close
export const ProgrammaticControl: Story = {
  render: () => {
    // Create a proper React component with capitalized name
    const ProgrammaticExample = () => {
      const [open, setOpen] = useState(false);

      const handleAction = () => {
        // Do something
        // Then close the sheet
        setOpen(false);
      };

      return (
        <InsetSheet open={open} onOpenChange={setOpen}>
          <InsetSheetWrapper>
            <div className="p-6 min-h-screen">
              <Button ariaLabel="Open programmatic sheet" handleClick={() => setOpen(true)}>
                Open Programmatic Sheet
              </Button>
            </div>
          </InsetSheetWrapper>

          <InsetSheetContent>
            <InsetSheetHeader>
              <InsetSheetTitle>Programmatic Control</InsetSheetTitle>
            </InsetSheetHeader>

            <div className="p-4">
              <p>This sheet is controlled programmatically.</p>
              <div className="mt-4">
                <Button ariaLabel="Perform action and close sheet" handleClick={handleAction}>
                  Perform Action & Close
                </Button>
              </div>
            </div>
          </InsetSheetContent>
        </InsetSheet>
      );
    };

    // Return the component from the render function
    return <ProgrammaticExample />;
  },
};
