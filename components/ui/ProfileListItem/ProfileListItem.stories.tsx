import type { Meta, StoryObj } from '@storybook/react';

import { ProfileListItem } from './ProfileListItem';

const meta: Meta<typeof ProfileListItem> = {
  component: ProfileListItem,
  decorators: [
    (Story) => (
      <main>
        <Story />
      </main>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProfileListItem>;

export const Default: Story = {
  args: {
    profilePicture: 'https://picsum.photos/200',
    name: 'Anders Christensen',
    title: 'UI Designer',
    status: 'from home',
    phoneNumber: '+45 87 18 91 28',
    email: 'anders@work.com',
  },
};

export const NoPicture: Story = {
  args: {
    name: 'Anders Christensen',
    title: 'UI Designer',
    status: 'from home',
    phoneNumber: '+45 87 18 91 28',
    email: 'anders@work.com',
  },
};
