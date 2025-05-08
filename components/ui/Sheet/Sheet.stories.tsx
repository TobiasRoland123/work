import type { Meta, StoryObj } from '@storybook/react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/Sheet/sheet';

const meta: Meta<typeof Sheet> = {
  component: Sheet,
};

export default meta;
type Story = StoryObj<typeof Sheet>;

const SheetRender = () => {
  return (
    <Sheet defaultOpen={true}>
      <SheetTrigger>Open</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Are you absolutely sure?</SheetTitle>
          <SheetDescription>
            This action cannot be undone. This will permanently delete your account and remove your
            data from our servers.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};

export const Default: Story = {
  render: () => <SheetRender />,
  name: 'Sheet',
};
