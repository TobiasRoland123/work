import Image from 'next/image';
import { Status } from '../Status/Status';
import { UserWithExtras } from '@/db/types';

export type ProfileListItemProps = {
  user: UserWithExtras;
  showStatus?: boolean;
};

export function ProfileListItem({ user, showStatus = false }: ProfileListItemProps) {
  const formattedTimed = user?.status?.time?.toLocaleTimeString('da-dk').substring(0, 5);
  const fromDate = user.status?.fromDate ? new Date(user.status?.fromDate) : null;
  const toDate = user.status?.toDate ? new Date(user.status?.toDate) : null;

  const formattedDates =
    fromDate && toDate
      ? `${fromDate.toLocaleDateString('da-DK')}-${toDate.toLocaleDateString('da-DK')}`
      : null;

  return (
    <div className="flex items-start gap-3 px-2 py-1 border-gray-400 max-w-[60ch] ">
      <div className="w-[60px] h-[60px] rounded-full overflow-hidden flex items-center justify-center bg-gray-400 shrink-0">
        {user.profilePicture ? (
          <Image
            key={user.profilePicture}
            src={user.profilePicture}
            alt={`Profile picture of ${user.firstName} ${user.lastName}`}
            width={60}
            height={60}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-white font-bold text-lg">
            {user.email.slice(0, user.email.indexOf('@')).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-24 leading-8 font-mono">{user.firstName + ' ' + user.lastName}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {user.organisationRoles &&
            user.organisationRoles.map((role, index) => (
              <p key={index} className="text-base">
                {role}
              </p>
            ))}

          {showStatus && user.status && <Status status={user.status.status} />}
          {user?.status?.time && <Status status={user.status.status}>{formattedTimed}</Status>}
          {formattedDates && user.status ? (
            <Status status={user.status.status}>{formattedDates}</Status>
          ) : null}
        </div>
        {user?.status?.details && (
          <div className={'mt-2'}>
            <small>Details:</small>
            <div className={'flex justify-between'}>
              <p className="max-w-[50ch] bg-white-blue p-2 rounded-md">{user.status.details}</p>
            </div>
          </div>
        )}

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
          <div>
            <a
              href={`mailto:${user.email}`}
              className="text-base font-sans font-light leading-5 underline text-link-blue hover:text-light-blue-hover"
            >
              {user.email}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
