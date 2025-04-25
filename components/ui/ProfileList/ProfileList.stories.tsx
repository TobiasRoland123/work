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
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
    ],
  },
};

export const OddList: Story = {
  args: {
    profiles: [
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        profilePicture: 'https://picsum.photos/200',
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
      {
        name: 'Anders Christensen',
        title: 'UI Designer',
        status: 'from home',
        phoneNumber: '+45 87 18 91 28',
        email: 'anders@work.com',
      },
    ],
  },
};
