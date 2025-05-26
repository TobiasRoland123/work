// filepath: /Users/jachobmollegard/Desktop/Charlie-Tango/workgit/work/components/ui/ProfileInfo/ProfileInfoFieldTest.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import ProfileInfo from '../ProfileInfo';
import { UserWithExtras } from '@/db/types';

const mockUser: UserWithExtras = {
  id: 1,
  userId: 'user-1',
  firstName: 'Anders',
  lastName: 'Christensen',
  email: 'anders@work.com',
  systemRole: 'USER',
  createdAt: '2024-01-01T00:00:00Z',
  organisationId: 1,
  mobilePhone: '+45 87 18 91 28',
  profilePicture: 'https://picsum.photos/200',
  status: {
    status: 'IN_OFFICE',
    id: 0,
    userID: '',
    details: null,
    time: null,
    fromDate: null,
    toDate: null,
    createdAt: '2024-01-01T00:00:00Z',
  },
  organisationRoles: ['Product Manager'],
  businessPhoneNumber: undefined,
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
    await expect(
      canvas.getByRole('heading', { name: `${mockUser.firstName} ${mockUser.lastName}` })
    ).toBeInTheDocument();
    await expect(canvas.getByText('Department')).toBeInTheDocument();
    await expect(canvas.getByText(String(mockUser.organisationId))).toBeInTheDocument();
    await expect(canvas.getByText('Title')).toBeInTheDocument();
    await expect(canvas.getByText(mockUser.organisationRoles?.[0] ?? '')).toBeInTheDocument();
    await expect(canvas.getByText('Phone')).toBeInTheDocument();
    await expect(canvas.getByText(String(mockUser.mobilePhone))).toBeInTheDocument();
    await expect(canvas.getByText('Mail')).toBeInTheDocument();
    await expect(canvas.getByText(mockUser.email)).toBeInTheDocument();
  },
};

export const RendersWithMissingOptionalFields: Story = {
  args: {
    user: {
      id: 1,
      userId: 'user-1',
      firstName: 'Anders',
      lastName: 'Christensen',
      email: 'anders@work.com',
      systemRole: 'USER',
      createdAt: '2024-01-01T00:00:00Z',
      organisationId: null,
      mobilePhone: '+45 87 18 91 28',
      profilePicture: 'https://picsum.photos/200',
      status: {
        status: 'IN_OFFICE',
        id: 0,
        userID: '',
        details: null,
        time: null,
        fromDate: null,
        toDate: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
      organisationRoles: [],
      businessPhoneNumber: undefined,
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
      id: 1,
      userId: 'user-1',
      firstName: '',
      lastName: '',
      email: '',
      systemRole: 'USER',
      createdAt: '2024-01-01T00:00:00Z',
      organisationId: null,
      mobilePhone: '',
      profilePicture: '',
      status: {
        status: 'IN_OFFICE',
        id: 0,
        userID: '',
        details: null,
        time: null,
        fromDate: null,
        toDate: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
      organisationRoles: [],
      businessPhoneNumber: undefined,
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
