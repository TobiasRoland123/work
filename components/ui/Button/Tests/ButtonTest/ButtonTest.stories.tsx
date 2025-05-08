import { Button } from '@/components/ui/Button/Button';
import { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

const buttonClickTest = () => {
  const message = document.createElement('p');
  const storyRoot = document.getElementById('storybook-root');
  message.textContent = 'Everything is perfect. Your works as intended when clicked!';
  storyRoot?.appendChild(message);
};

export const ButtonClickTests: Story = {
  args: {
    variant: 'default',
    handleClick: buttonClickTest,
    children: 'Button',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button'));

    // 👇 Assert DOM structure
    await expect(
      canvas.getByText('Everything is perfect. Your works as intended when clicked!')
    ).toBeInTheDocument();
  },
};

export const ButtonChildrenTests: Story = {
  args: {
    variant: 'default',
    children: 'im the button text',
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('im the button text')).toBeInTheDocument();
  },
};

export const ButtonLargeVariantTests: Story = {
  args: {
    variant: 'large',
    children: 'I should be large variant',
    ariaLabel: 'aria label text',
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button')).toHaveClass('w-full');
    await expect(canvas.getByRole('button')).toHaveAttribute('aria-label', 'aria label text');
  },
};
