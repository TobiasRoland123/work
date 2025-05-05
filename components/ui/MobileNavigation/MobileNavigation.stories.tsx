import type { Meta, StoryObj } from '@storybook/react';
import { MobileNavigation } from '@/components/ui/MobileNavigation/Mobilenavigation';
import { linkProps } from '@/types/link';

const meta: Meta<typeof MobileNavigation> = {
  component: MobileNavigation,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};

export default meta;
type Story = StoryObj<typeof MobileNavigation>;

const links: Array<linkProps> = [
  { href: '#', label: 'Today' },
  { href: '#', label: 'Contact' },
  { href: '#', label: 'Profile' },
];

const MobileNavigationRender = () => {
  return (
    <div className={'relative'}>
      <div className={'fixed bottom-0 left-0 w-full'}>
        <MobileNavigation linkList={links} />
      </div>
    </div>
  );
};

export const Default: Story = {
  name: 'MobileNavigation',
  render: () => <MobileNavigationRender />,
};
