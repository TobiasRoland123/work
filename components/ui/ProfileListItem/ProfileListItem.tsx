import Image from 'next/image';
import { Status } from '../Status/Status';
import { UserWithExtras } from '@/db/types';

export type ProfileListItemProps = {
  user: UserWithExtras;
  showStatus?: boolean;
};

export function ProfileListItem({ user, showStatus = false }: ProfileListItemProps) {
  return (
    <div className="flex items-center gap-3 px-2 py-1 border-gray-400">
      {user.profilePicture ? (
        <Image
          src={user.profilePicture}
          alt={`Profile picture of ${user.firstName} ${user.lastName}`}
          style={{ objectFit: 'cover' }}
          width={60}
          height={60}
          className="rounded-full relative bottom-2 aspect-square"
        />
      ) : (
        <div
          className="size-15 aspect-square bg-gray-400 rounded-full flex items-center justify-center relative bottom-2"
          role="img"
          aria-label={`Default profile picture for ${user.firstName}`}
        ></div>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-24 leading-8 font-mono">{user.firstName + ' ' + user.lastName}</h2>
        <div className="flex items-center gap-2">
          {user.organisationRoles &&
            user.organisationRoles.map((role, index) => (
              <p key={index} className="text-base">
                {role}
              </p>
            ))}

          {showStatus && user.status && <Status status={user.status.status} />}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          {(user.businessPhoneNumber || user.mobilePhone) && (
            <div>
              <a
                href={`tel:${user.businessPhoneNumber ? user.businessPhoneNumber : user.mobilePhone}`}
                className="text-base font-sans font-light leading-5 underline text-link-blue hover:text-light-blue-hover"
              >
                {user.businessPhoneNumber ? user.businessPhoneNumber : user.mobilePhone}
              </a>
            </div>
          )}

          <a
            href={`mailto:${user.email}`}
            className="text-base font-sans font-light leading-5 underline text-link-blue hover:text-light-blue-hover"
          >
            {user.email}
          </a>
        </div>
      </div>
    </div>
  );
}
