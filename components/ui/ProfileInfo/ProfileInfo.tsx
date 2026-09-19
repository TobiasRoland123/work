import { getSlackImageUrl } from '@/lib/slack/image';
import React from 'react';

import ProfileInfoField from './ProfileInfoField';
import { UserWithExtras } from '@/db/types';
import Image from 'next/image';
import './profile-info.css';

interface UserProps {
  user: UserWithExtras;
}

const ProfileInfo = ({ user }: UserProps) => {
  const profilePicture = getSlackImageUrl(user.profilePicture);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
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
    <section className="profile-info">
      <div className="profile-info__hero">
        <div className="profile-info__avatar-wrap">
          <div className="profile-info__avatar">
            {profilePicture ? (
              <Image
                src={profilePicture}
                unoptimized
                alt={`Profile picture of ${name || user.email}`}
                width={120}
                height={120}
                className="profile-info__avatar-image"
              />
            ) : (
              <span aria-label={`Profile initials for ${name || user.email}`}>{initials}</span>
            )}
          </div>
          <small>Profile photo is synced from Slack</small>
        </div>
        <div className="profile-info__heading">
          <span>Your information</span>
          <h2>{heading}</h2>
        </div>
      </div>

      <div className="profile-info__fields">
        {name ? <ProfileInfoField label={'Name'} value={name} /> : null}
        {user?.organisation ? (
          <ProfileInfoField label={'Department'} value={String(user.organisation)} />
        ) : null}
        {user?.organisationRoles && user.organisationRoles.length > 0 ? (
          <ProfileInfoField label={'Title'} value={user.organisationRoles[0]} />
        ) : null}

        {user?.mobilePhone ? (
          <ProfileInfoField
            label={'Phone'}
            value={user.mobilePhone ?? ''}
            href={`tel:${user.mobilePhone}`}
          />
        ) : null}

        {user?.email ? (
          <ProfileInfoField label={'Mail'} value={user.email} href={`mailto:${user.email}`} />
        ) : null}
      </div>
    </section>
  );
};

export default ProfileInfo;
