import React from 'react';

import ProfileInfoField from './ProfileInfoField';
import { UserWithExtras } from '@/db/types';

interface UserProps {
  user: UserWithExtras;
}

const ProfileInfo = ({ user }: UserProps) => {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const heading = name ? name : 'Profile';
  return (
    <div className="p-4">
      <section>
        <span className="font-mono text-base">Your information</span>
        <h1 className="text-5xl font-mono leading-14 font-light">{heading}</h1>
      </section>
      <section className="flex flex-col">
        <ProfileInfoField label={'Name'} value={name} />
        {user?.organisation && (
          <ProfileInfoField label={'Department'} value={String(user.organisation)} />
        )}
        {user?.organisationRoles && user.organisationRoles.length > 0 && (
          <ProfileInfoField label={'Title'} value={user.organisationRoles[0]} />
        )}

        <ProfileInfoField label={'Phone'} value={user.mobilePhone ?? ''} />

        <ProfileInfoField label={'Mail'} value={user.email} />
      </section>
    </div>
  );
};

export default ProfileInfo;
