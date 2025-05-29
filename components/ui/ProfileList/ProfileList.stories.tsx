import type { Meta, StoryObj } from '@storybook/react';

import { ProfileList } from './ProfileList';

const meta: Meta<typeof ProfileList> = {
  component: ProfileList,
};

export default meta;
type Story = StoryObj<typeof ProfileList>;

export const Default: Story = {
  args: {
    profiles: [
      {
        id: 1,
        userId: 'user-1',
        firstName: 'Anders',
        lastName: 'Christensen',
        email: 'anders@work.com',
        systemRole: 'USER',
        createdAt: '2024-01-01T00:00:00Z',
        organisationId: 1,
        organisation: 'Charlie Tango',
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
      },
      {
        id: 2,
        userId: 'user-2',
        firstName: 'Maria',
        lastName: 'Jensen',
        email: 'maria@work.com',
        systemRole: 'USER',
        createdAt: '2024-01-01T00:00:00Z',
        organisationId: 1,
        organisation: 'Charlie Tango',
        mobilePhone: '+45 23 45 67 89',
        profilePicture: 'https://picsum.photos/201',
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
        organisationRoles: ['Frontend Developer'],
        businessPhoneNumber: undefined,
      },
    ],
  },
};

export const OddList: Story = {
  args: {
    profiles: [
      {
        id: 1,
        userId: 'user-1',
        firstName: 'Anders',
        lastName: 'Christensen',
        email: 'anders@work.com',
        systemRole: 'USER',
        createdAt: '2024-01-01T00:00:00Z',
        organisationId: 1,
        organisation: 'Charlie Tango',
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
      },
      {
        id: 2,
        userId: 'user-2',
        firstName: 'Maria',
        lastName: 'Jensen',
        email: 'maria@work.com',
        systemRole: 'USER',
        createdAt: '2024-01-01T00:00:00Z',
        organisationId: 1,
        organisation: 'Charlie Tango',
        mobilePhone: '+45 23 45 67 89',
        profilePicture: 'https://picsum.photos/201',
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
        organisationRoles: ['Frontend Developer'],
        businessPhoneNumber: undefined,
      },
      {
        id: 3,
        userId: 'user-3',
        firstName: 'Peter',
        lastName: 'Nielsen',
        email: 'peter@work.com',
        systemRole: 'USER',
        createdAt: '2024-01-01T00:00:00Z',
        organisationId: 1,
        organisation: 'Charlie Tango',
        mobilePhone: '+45 32 14 76 98',
        profilePicture: 'https://picsum.photos/202',
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
      },
    ],
  },
};
