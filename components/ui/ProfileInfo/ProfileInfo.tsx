import React from 'react';

import ProfileInfoField from './ProfileInfoField';
import { UserWithExtras } from '@/db/types';
import { Logo } from '@/components/ui/Logo/Logo';
import ProfileImageUploader from '@/components/ProfileImageUploader/ProfileImageUploader';
import Link from 'next/link';

interface UserProps {
  user: UserWithExtras;
}

const ProfileInfo = ({ user }: UserProps) => {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const heading = name ? name : 'Profile';
  return (
    <section className="p-4  ">
      <Link href={'/'}>
        <Logo />
      </Link>
      <div className={'pt-9 flex flex-col lg:flex-row lg:gap-10 items-center'}>
        <ProfileImageUploader
          currentImage={user?.profilePicture ? user.profilePicture : null}
          userEmail={user.email}
          alt={`Profile picture of ${user.firstName} ${user.lastName}`}
        />
        <div className="mt-6 lg:mt-0">
          <span className="font-mono text-base text-center pt-4 md:text-start mx-auto block">
            Your information
          </span>
          <h1 className="text-5xl font-mono leading-14 text-center md:text-start font-light pt-4 lg:pt-0">
            {heading}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-8 mt-16">
        {name ? <ProfileInfoField label={'Name'} value={name} /> : null}
        {user?.organisation ? (
          <ProfileInfoField label={'Department'} value={String(user.organisation)} />
        ) : null}
        {user?.organisationRoles && user.organisationRoles.length > 0 ? (
          <ProfileInfoField label={'Title'} value={user.organisationRoles[0]} />
        ) : null}

        {user?.mobilePhone ? (
          <ProfileInfoField label={'Phone'} value={user.mobilePhone ?? ''} />
        ) : null}

        {user?.email ? <ProfileInfoField label={'Mail'} value={user.email} /> : null}
      </div>
    </section>
  );
};

export default ProfileInfo;
