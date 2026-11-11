import { Button } from '@/components/ui/Button/Button';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';

const meta: Meta<typeof Button> = { component: Button };
export default meta;
type Story = StoryObj<typeof Button>;

export const ButtonLinkPropsPresent: Story = {
  args: {
    link: { href: '/profile', label: 'Open profile', target: '_blank' },
    ariaLabel: 'Open your profile',
    children: 'Unused children',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Open your profile' });
    await expect(link).toHaveAttribute('href', '/profile');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('tabindex', '0');
    await expect(link).toHaveAttribute('aria-disabled', 'false');
    await expect(link).toHaveTextContent('Open profile');
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Unused children')).not.toBeInTheDocument();
  },
};

export const LinkUsesChildren: Story = {
  args: { link: { href: '/today' }, children: 'Today', ariaLabel: 'Today' },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Today' });
    await expect(link).toHaveTextContent('Today');
    await expect(link).toHaveAttribute('href', '/today');
    await expect(link).toHaveAttribute('target', '_self');
  },
};

export const LoadingLinkLeavesTabOrder: Story = {
  args: { link: { href: '/profile', label: 'Profile' }, ariaLabel: 'Profile', isLoading: true },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Profile' });
    await expect(link).toHaveAttribute('aria-disabled', 'true');
    await expect(link).toHaveAttribute('tabindex', '-1');
    await expect(link).toHaveTextContent('Profile');
  },
};

export const MissingDestinationUsesButton: Story = {
  args: { link: { label: 'Save' }, children: 'Save', ariaLabel: 'Save' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Save' })).toHaveTextContent('Save');
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  },
};
