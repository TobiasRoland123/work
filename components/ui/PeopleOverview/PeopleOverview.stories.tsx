import type { Meta, StoryObj } from '@storybook/react';
import PeopleOverview from './PeopleOverview';
import { useState } from 'react';
import { ProfileListItemProps } from '../ProfileListItem/ProfileListItem';
import { StatusType } from '../Status/Status';

// Sample profile data
const sampleProfiles = [
  {
    profilePicture: 'https://picsum.photos/200',
    name: 'Anders Christensen',
    title: 'UI Designer',
    status: 'from home' as StatusType,
    phoneNumber: '+45 87 18 91 28',
    email: 'anders@work.com',
  },
  {
    profilePicture: 'https://picsum.photos/201',
    name: 'Maria Jensen',
    title: 'Frontend Developer',
    status: 'in office' as StatusType,
    phoneNumber: '+45 23 45 67 89',
    email: 'maria@work.com',
  },
  {
    profilePicture: 'https://picsum.photos/202',
    name: 'Peter Nielsen',
    title: 'Product Manager',
    status: 'in office' as StatusType,
    phoneNumber: '+45 32 14 76 98',
    email: 'peter@work.com',
  },
];

// Wrapper component to handle state
const PeopleOverviewWrapper = (props: {
  initialProfiles: ProfileListItemProps[];
  initialOfficeStatus?: boolean;
}) => {
  const [officeStatus, setOfficeStatus] = useState(props.initialOfficeStatus || false);
  const [profiles] = useState(props.initialProfiles || []);

  const filteredProfiles = officeStatus
    ? profiles.filter((profile) => profile.status === 'in office')
    : profiles.filter((profile) => profile.status !== 'in office');

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
  render: () => <PeopleOverviewWrapper initialProfiles={sampleProfiles} />,
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
