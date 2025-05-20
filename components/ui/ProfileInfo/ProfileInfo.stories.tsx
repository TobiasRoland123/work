import type { Meta, StoryObj } from '@storybook/react';
import ProfileInfo from './ProfileInfo';
import { UserWithExtras } from '@/db/types';

const sampleProfile: UserWithExtras = {
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
  },
  organisationRoles: ['Product Manager'],
  businessPhoneNumber: undefined,
};

const meta: Meta<typeof ProfileInfo> = {
  component: ProfileInfo,
  title: 'UI/ProfileInfo',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ProfileInfo>;

export const Default: Story = {
  render: () => (
    <div className="relative min-h-[600px]">
      <ProfileInfo user={sampleProfile} />
    </div>
  ),
};
