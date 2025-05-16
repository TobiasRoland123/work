// filepath: /Users/jachobmollegard/Desktop/Charlie-Tango/workgit/work/components/ui/ProfileInfo/ProfileInfoFieldTest.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import ProfileInfo from '../ProfileInfo';

const mockUser = {
  name: 'Jane Doe',
  department: 'Engineering',
  title: 'Senior Developer',
  phoneNumber: '123-456-7890',
  email: 'jane.doe@example.com',
};

const meta: Meta<typeof ProfileInfo> = {
  component: ProfileInfo,
  title: 'UI/ProfileInfo/Test/ProfileInfoTest',
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ProfileInfo>;

export const RendersAllFields: Story = {
  args: {
    user: mockUser,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Your information')).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: mockUser.name })).toBeInTheDocument();
    await expect(canvas.getByText('Department')).toBeInTheDocument();
    await expect(canvas.getByText(mockUser.department)).toBeInTheDocument();
    await expect(canvas.getByText('Title')).toBeInTheDocument();
    await expect(canvas.getByText(mockUser.title)).toBeInTheDocument();
    await expect(canvas.getByText('Phone')).toBeInTheDocument();
    await expect(canvas.getByText(mockUser.phoneNumber)).toBeInTheDocument();
    await expect(canvas.getByText('Mail')).toBeInTheDocument();
    await expect(canvas.getByText(mockUser.email)).toBeInTheDocument();
  },
};

export const RendersWithMissingOptionalFields: Story = {
  args: {
    user: {
      name: 'John Smith',
      department: '',
      title: '',
      phoneNumber: '555-555-5555',
      email: 'john.smith@example.com',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // Department and Title labels should not be rendered
    expect(canvas.queryByText('Department')).toBeNull();
    expect(canvas.queryByText('Title')).toBeNull();
    await expect(canvas.getByText('Phone')).toBeInTheDocument();
    await expect(canvas.getByText('Mail')).toBeInTheDocument();
  },
};

export const HandlesEmptyValues: Story = {
  args: {
    user: {
      name: '',
      department: '',
      title: '',
      phoneNumber: '',
      email: '',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Should render the labels even if values are empty
    await expect(canvas.getByText('Your information')).toBeInTheDocument();
    await expect(canvas.getByText('Name')).toBeInTheDocument();
    await expect(canvas.getByText('Phone')).toBeInTheDocument();
    await expect(canvas.getByText('Mail')).toBeInTheDocument();
  },
};
