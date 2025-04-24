import type { Meta, StoryObj } from '@storybook/react';

import { ProfileListItem } from './ProfileListItem';

const meta: Meta<typeof ProfileListItem> = {
  component: ProfileListItem,
};

export default meta;
type Story = StoryObj<typeof ProfileListItem>;

const singleColList = () => {
  return (
    <div className={'flex flex-col gap-4'}>
      <ProfileListItem
        profilePicture="https://picsum.photos/200"
        name="Anders Christensen"
        title="UI Designer"
        status={{ message: 'From home' }}
        phoneNumber="+45 87 18 91 28"
        email="anders@work.com"
      />
      <ProfileListItem
        profilePicture="https://picsum.photos/200"
        name="Jon Doe"
        title="Technical Lead"
        status={{ message: 'At work' }}
        phoneNumber="+45 22 50 50 44"
        email="jondoe@work.com"
      />
      <ProfileListItem
        profilePicture="https://picsum.photos/200"
        name="Jane Doe"
        title="Team Lead"
        status={{ message: 'At work' }}
        phoneNumber="+45 24 60 51 84"
        email="janedoe@work.com"
      />
      <ProfileListItem
        profilePicture="https://picsum.photos/200"
        name="Børge Hansen"
        title="Intern"
        status={{ message: 'Sick', absent: true }}
        phoneNumber="+45 22 50 50 44"
        email="børge@work.com"
      />
      <ProfileListItem
        profilePicture="https://picsum.photos/200"
        name="Fiona Jensen"
        title="Junior Developer"
        status={{ message: 'At client' }}
        phoneNumber="+45 44 55 50 44"
        email="fiona@work.com"
      />
      <ProfileListItem
        profilePicture="https://picsum.photos/200"
        name="Karl Emil"
        title="Boss"
        status={{ message: 'Vacation', absent: true }}
        phoneNumber="+45 80 00 08 13"
        email="MrMoney@work.com"
      />
    </div>
  );
};

const doubleColList = () => {
  return (
    <div className="flex gap-16">
      <div className={'flex flex-col'}>
        <ProfileListItem
          profilePicture="https://picsum.photos/200"
          name="Anders Christensen"
          title="UI Designer"
          status={{ message: 'From home' }}
          phoneNumber="+45 87 18 91 28"
          email="anders@work.com"
        />
        <ProfileListItem
          profilePicture="https://picsum.photos/200"
          name="Jon Doe"
          title="Technical Lead"
          status={{ message: 'At work' }}
          phoneNumber="+45 22 50 50 44"
          email="jondoe@work.com"
        />
        <ProfileListItem
          profilePicture="https://picsum.photos/200"
          name="Jane Doe"
          title="Team Lead"
          status={{ message: 'At work' }}
          phoneNumber="+45 24 60 51 84"
          email="janedoe@work.com"
        />
      </div>
      <div className={'flex flex-col'}>
        <ProfileListItem
          profilePicture="https://picsum.photos/200"
          name="Børge Hansen"
          title="Intern"
          status={{ message: 'Sick', absent: true }}
          phoneNumber="+45 22 50 50 44"
          email="børge@work.com"
        />
        <ProfileListItem
          profilePicture="https://picsum.photos/200"
          name="Fiona Jensen"
          title="Junior Developer"
          status={{ message: 'At client' }}
          phoneNumber="+45 44 55 50 44"
          email="fiona@work.com"
        />
        <ProfileListItem
          profilePicture="https://picsum.photos/200"
          name="Karl Emil"
          title="Boss"
          status={{ message: 'Vacation', absent: true }}
          phoneNumber="+45 80 00 08 13"
          email="MrMoney@work.com"
        />
      </div>
    </div>
  );
};

export const Default: Story = {
  args: {
    profilePicture: 'https://picsum.photos/200',
    name: 'Anders Christensen',
    title: 'UI Designer',
    status: {
      message: 'From home',
    },
    phoneNumber: '+45 87 18 91 28',
    email: 'anders@work.com',
  },
};

export const SingleColList: Story = {
  render: () => singleColList(),
};

export const DoubleColList: Story = {
  render: () => doubleColList(),
};
