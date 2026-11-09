import { Button } from '@/components/ui/Button/Button';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';

const meta: Meta<typeof Button> = { component: Button };
export default meta;
type Story = StoryObj<typeof Button>;

const onClick = fn();

export const ButtonClickTests: Story = {
  args: { handleClick: onClick, children: 'Save', ariaLabel: 'Save attendance' },
  play: async ({ canvasElement }) => {
    onClick.mockClear();
    const button = within(canvasElement).getByRole('button', { name: 'Save attendance' });
    await userEvent.click(button);
    await expect(onClick).toHaveBeenCalledTimes(1);
    button.focus();
    await userEvent.keyboard('{Enter}');
    await expect(onClick).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(' ');
    await expect(onClick).toHaveBeenCalledTimes(3);
  },
};

export const ButtonChildrenTests: Story = {
  args: { children: 'Save attendance', ariaLabel: 'Save attendance' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save attendance' });
    await expect(button).toHaveTextContent('Save attendance');
    await expect(button).toHaveAttribute('type', 'button');
    await expect(button).toBeEnabled();
  },
};

export const ButtonLargeVariantTests: Story = {
  args: { variant: 'large', children: 'Continue', ariaLabel: 'Continue to status' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Continue to status' });
    await expect(button).toHaveClass('w-full');
    await expect(button).toHaveTextContent('Continue');
  },
};

export const ButtonPropsPresentTest: Story = {
  args: {
    children: 'Save',
    label: 'Submit attendance',
    ariaLabel: 'Submit attendance',
    type: 'submit',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Submit attendance' });
    await expect(button).toHaveAttribute('type', 'submit');
    await expect(button).toHaveTextContent('Submit attendance');
    await expect(canvas.queryByText('Save')).not.toBeInTheDocument();
  },
};

const whileLoading = fn();
export const LoadingPreventsSubmission: Story = {
  args: {
    children: 'Save',
    ariaLabel: 'Save attendance',
    isLoading: true,
    handleClick: whileLoading,
  },
  play: async ({ canvasElement }) => {
    whileLoading.mockClear();
    const button = within(canvasElement).getByRole('button', { name: 'Save attendance' });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    button.click();
    await expect(whileLoading).not.toHaveBeenCalled();
  },
};
