import type { Meta, StoryObj } from '@storybook/react';

import { ProfileListItem } from './ProfileListItem';

const meta: Meta<typeof ProfileListItem> = {
  component: ProfileListItem,
};

export default meta;
type Story = StoryObj<typeof ProfileListItem>;

export const Default: Story = {
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
};

export const NoPicture: Story = {
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
};
