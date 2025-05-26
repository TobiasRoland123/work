import type { Meta, StoryObj } from '@storybook/react';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';
import { Button } from '@/components/ui/Button/Button';

const meta: Meta<typeof Drawer> = {
  component: Drawer,
};

export default meta;
type Story = StoryObj<typeof Drawer>;

const DrawerExample = () => {
  return (
    <Drawer>
      <DrawerTrigger aria-controls={'radix-<<11>>'}>Open</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Are you absolutely sure?</DrawerTitle>
          <DrawerDescription>This action cannot be undone.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button ariaLabel="Submit">Submit</Button>
          <DrawerClose>
            <Button ariaLabel="Cancel" variant="default">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export const Primary: Story = {
  render: () => <DrawerExample />,
  name: 'Drawer',
};
