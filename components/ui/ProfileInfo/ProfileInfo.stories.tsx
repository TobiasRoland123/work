import type { Meta, StoryObj } from '@storybook/react';
import ProfileInfo from './ProfileInfo';
import { StatusType } from '../Status/Status';

const sampleProfile = {
  profilePicture: 'https://picsum.photos/200',
  name: 'Anders Christensen',
  title: 'UI Designer',
  status: 'from home' as StatusType,
  phoneNumber: '+45 87 18 91 28',
  email: 'anders@work.com',
  department: 'Design',
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
