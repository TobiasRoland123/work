import type { Meta, StoryObj } from '@storybook/react';
import { AppSidebar } from '@/components/ui/Sidebar/app-sidebar';
import { SidebarProvider } from '@/components/ui/Sidebar/sidebar';
import { linkProps } from '@/types/link';

const meta: Meta<typeof AppSidebar> = {
  component: AppSidebar,
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};

export default meta;
type Story = StoryObj<typeof AppSidebar>;

const links: Array<linkProps> = [
  { href: '#', label: 'Today' },
  { href: '#', label: 'Contact' },
  { href: '#', label: 'Profile' },
];

const AppSidebarRender = () => {
  return (
    <SidebarProvider>
      <AppSidebar linkList={links} />
    </SidebarProvider>
  );
};

export const Default: Story = {
  name: 'Sidebar',
  render: () => <AppSidebarRender />,
};
