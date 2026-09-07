import React from 'react';

import ProfileInfoField from './ProfileInfoField';
import { UserWithExtras } from '@/db/types';
import { Logo } from '@/components/ui/Logo/Logo';
import Link from 'next/link';
import Image from 'next/image';

interface UserProps {
  user: UserWithExtras;
}

const ProfileInfo = ({ user }: UserProps) => {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const heading = name ? name : 'Profile';
  const initials = name
    ? name
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase();
  return (
    <section className="p-4  ">
      <Link href={'/'}>
        <Logo />
      </Link>
      <div className={'pt-9 flex flex-col lg:flex-row lg:gap-10 items-center'}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-[120px] h-[120px] rounded-full overflow-hidden flex items-center justify-center bg-neutral-500">
            {user.profilePicture ? (
              <Image
                src={`/api/image-proxy?url=${encodeURIComponent(user.profilePicture)}`}
                alt={`Profile picture of ${name || user.email}`}
                width={120}
                height={120}
                className="object-cover w-full h-full"
              />
            ) : (
              <span
                className="text-white font-bold text-3xl"
                aria-label={`Profile initials for ${name || user.email}`}
              >
                {initials}
              </span>
            )}
          </div>
          <small className="text-center text-neutral-600">Profile photo is synced from Slack</small>
        </div>
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
