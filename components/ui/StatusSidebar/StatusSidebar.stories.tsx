import type { Meta, StoryObj } from '@storybook/react';
import { StatusSidebar } from '@/components/ui/StatusSidebar/StatusSidebar';
const meta: Meta<typeof StatusSidebar> = {
  component: StatusSidebar,
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};

export default meta;
type Story = StoryObj<typeof StatusSidebar>;

export const Default: Story = {
  args: {
    open: 'status',
  },
  name: 'StatusSidebar',
};
