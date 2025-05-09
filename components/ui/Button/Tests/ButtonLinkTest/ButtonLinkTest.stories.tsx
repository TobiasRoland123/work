import { Button } from '@/components/ui/Button/Button';
import { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const ButtonLinkPropsPresent: Story = {
  args: {
    variant: 'default',
    link: { href: '#', label: 'Button as Link' },
    ariaLabel: 'Button Link ariaLabel',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('link')).toHaveAttribute('aria-label', 'Button Link ariaLabel');
    await expect(canvas.getByRole('link')).toHaveAttribute('href', '#');
  },
};
