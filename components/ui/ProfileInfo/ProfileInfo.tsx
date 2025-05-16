import React from 'react';
import { ProfileListItemProps } from '../ProfileListItem/ProfileListItem';
import ProfileInfoField from './ProfileInfoField';

interface UserProps {
  user: ProfileListItemProps;
}

const ProfileInfo = ({ user }: UserProps) => {
  return (
    <div className="p-4">
      <section>
        <span className="font-mono text-base">Your information</span>
        <h1 className="text-5xl font-mono leading-14 font-light">{user.name}</h1>
      </section>
      <section className="flex flex-col">
        <ProfileInfoField label={'Name'} value={user.name} />
        {user?.department && <ProfileInfoField label={'Department'} value={user.department} />}
        {user?.title && <ProfileInfoField label={'Title'} value={user.title} />}

        <ProfileInfoField label={'Phone'} value={user.phoneNumber} />
        <ProfileInfoField label={'Mail'} value={user.email} />
      </section>
    </div>
  );
};

export default ProfileInfo;
