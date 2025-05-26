import type { Meta, StoryObj } from '@storybook/react';
import PeopleOverview from './PeopleOverview';
import { useState } from 'react';

import { UserWithExtras } from '@/db/types';

// Sample profile data
const sampleProfiles: UserWithExtras[] = [
  {
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
  },
  {
    id: 2,
    userId: 'user-2',
    firstName: 'Maria',
    lastName: 'Jensen',
    email: 'maria@work.com',
    systemRole: 'USER',
    createdAt: '2024-01-03T00:00:00Z',
    organisationId: 1,
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
      createdAt: '2024-02-01T00:00:00Z',
    },
    organisationRoles: ['Product Manager'],
    businessPhoneNumber: undefined,
  },
];

// Wrapper component to handle state
const PeopleOverviewWrapper = (props: {
  initialProfiles: UserWithExtras[];
  initialOfficeStatus?: boolean;
}) => {
  const [officeStatus, setOfficeStatus] = useState(props.initialOfficeStatus || false);
  const [profiles] = useState(props.initialProfiles || []);

  const filteredProfiles = officeStatus
    ? profiles.filter((profile) => profile.status?.status === 'IN_OFFICE')
    : profiles.filter((profile) => profile.status?.status !== 'IN_OFFICE');

  return (
    <PeopleOverview
      profiles={filteredProfiles}
      officeStatus={officeStatus}
      setOfficeStatus={setOfficeStatus}
    />
  );
};

const meta: Meta<typeof PeopleOverview> = {
  component: PeopleOverview,
};

export default meta;
type Story = StoryObj<typeof PeopleOverview>;

export const Default: Story = {
  render: () => <PeopleOverviewWrapper initialProfiles={sampleProfiles} initialOfficeStatus />,
};

export const InOffice: Story = {
  render: () => (
    <PeopleOverviewWrapper initialProfiles={sampleProfiles} initialOfficeStatus={true} />
  ),
};

export const OutOfOffice: Story = {
  render: () => (
    <PeopleOverviewWrapper initialProfiles={sampleProfiles} initialOfficeStatus={false} />
  ),
};
