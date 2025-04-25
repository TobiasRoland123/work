import type { Meta, StoryObj } from '@storybook/react';
import LoginForm from './LoginForm';
import { userEvent, within } from '@storybook/test';

const meta: Meta<typeof LoginForm> = {
  component: LoginForm,
  title: 'UI/LoginForm',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <main>
        <Story />
      </main>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LoginForm>;

export const Default: Story = {
  render: () => (
    <div className="relative min-h-[600px]">
      <LoginForm />
    </div>
  ),
};

export const WithValues: Story = {
  render: () => (
    <div className="relative min-h-[600px]">
      <LoginForm />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Get form fields by their labels
    const nameInput = canvas.getByLabelText('Name');
    const passwordInput = canvas.getByLabelText('Password');

    // Fill in the fields
    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(passwordInput, 'password123');

    // Optional: Verify the values were entered
    // await expect(nameInput).toHaveValue('John Doe');
    // await expect(passwordInput).toHaveValue('password123');
  },
};

export const ValidationErrors: Story = {
  render: () => (
    <div className="relative min-h-[600px]">
      <LoginForm />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Get form fields by their labels
    const nameInput = canvas.getByLabelText('Name');
    // const passwordInput = canvas.getByLabelText('Password');

    // Fill in with invalid data (username too short, empty password)
    await userEvent.type(nameInput, 'A');

    // Find and click the submit button
    const submitButton = canvas.getByRole('button', { name: /log ind/i });
    await userEvent.click(submitButton);
  },
};

export const MobileView: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: () => (
    <div className="relative min-h-[600px]">
      <LoginForm />
    </div>
  ),
};

export const DesktopView: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
  render: () => (
    <div className="relative min-h-[600px]">
      <LoginForm />
    </div>
  ),
};
