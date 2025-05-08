import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

const allVariants = () => {
  return (
    <div className={'flex gap-4 flex-col'}>
      <Button>Button</Button>
      <Button variant={'large'}>Button</Button>
      <Button link={{ href: '#', label: ' im a link' }} />
      <Button variant={'large'} link={{ href: '#', label: ' im a link, but large' }} />
      <Button
        variant={'large'}
        link={{ href: '#', label: ' im a link, but open in new tab', target: '_blank' }}
      />
    </div>
  );
};

export const AllVariants: Story = {
  render: () => allVariants(),
};

export const Default: Story = {
  args: {
    variant: 'default',
    children: 'Button',
  },
};

export const Large: Story = {
  args: {
    variant: 'large',
    children: 'Button',
  },
};

export const AsLinkDefault: Story = {
  args: {
    variant: 'default',
    link: { href: '#', label: 'Button as Link' },
  },
};

export const AsLinkLarge: Story = {
  args: {
    variant: 'large',
    link: { href: '#', label: 'Button as Link' },
  },
};

export const AsLinkTargetNewPage: Story = {
  args: {
    variant: 'large',
    link: { href: '#', label: 'Opens in new page', target: '_blank' },
  },
};
