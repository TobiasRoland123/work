import type { Meta, StoryObj } from '@storybook/react';
import { StatusDrawer } from '@/components/ui/StatusDrawer/StatusDrawer';
const meta: Meta<typeof StatusDrawer> = {
  component: StatusDrawer,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};

export default meta;
type Story = StoryObj<typeof StatusDrawer>;

export const Default: Story = {
  name: 'StatusDrawer',
};
