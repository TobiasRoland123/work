import Image from 'next/image';
import { Status } from '../Status/Status';
import { UserWithExtras } from '@/db/types';

export type ProfileListItemProps = {
  user: UserWithExtras;
  showStatus?: boolean;
};

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('da-DK', {
    timeZone: 'Europe/Copenhagen',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatInterval(
  startsAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  startsAtApproximate = false,
  endsAtApproximate = false
) {
  if (!startsAt || !endsAt) return null;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const plainTime = (value: Date) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Copenhagen',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(value);
  const time = (value: Date, approximate: boolean) =>
    `${approximate ? 'ca. ' : ''}${plainTime(value)}`;
  const startIsMidnight = plainTime(start) === '00:00';
  const endIsMidnight = plainTime(end) === '00:00';
  if (startIsMidnight && endIsMidnight) return null;
  if (startIsMidnight) return `Until ${time(end, endsAtApproximate)}`;
  if (endIsMidnight) return `From ${time(start, startsAtApproximate)}`;
  return `${time(start, startsAtApproximate)}-${time(end, endsAtApproximate)}`;
}

export function ProfileListItem({ user, showStatus = false }: ProfileListItemProps) {
  const imported = Boolean(user.status?.sourceMessageKey);
  const actionBound = imported ? null : user.status?.time;
  const statusTime = actionBound ? new Date(actionBound) : null;
  const formattedTimed =
    statusTime && !Number.isNaN(statusTime.getTime())
      ? new Intl.DateTimeFormat('da-DK', {
          timeZone: 'Europe/Copenhagen',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(statusTime)
      : null;
  const fromDate = user.status?.fromDate ?? null;
  const toDate = user.status?.toDate ?? null;

  const formattedDates =
    fromDate && toDate ? `${formatDate(fromDate)}-${formatDate(toDate)}` : null;
  const formattedInterval = imported
    ? formatInterval(
        user.status?.startsAt,
        user.status?.endsAt,
        user.status?.startsAtApproximate,
        user.status?.endsAtApproximate
      )
    : null;
  const actionTimeApproximate =
    user.status?.status === 'IN_LATE'
      ? user.status?.endsAtApproximate
      : user.status?.status === 'LEAVING_EARLY'
        ? user.status?.startsAtApproximate
        : false;
  const formattedActionTime =
    formattedTimed && actionTimeApproximate ? `ca. ${formattedTimed}` : formattedTimed;

  return (
    <div className="flex items-start gap-3 px-2 py-1 border-gray-400 max-w-[60ch] ">
      <div className="w-[60px] h-[60px] rounded-full overflow-hidden flex items-center justify-center bg-neutral-500 shrink-0">
        {user.profilePicture ? (
          <Image
            key={user.profilePicture}
            src={`/api/image-proxy?url=${encodeURIComponent(user.profilePicture)}`}
            alt={`Profile picture of ${user.firstName} ${user.lastName}`}
            width={60}
            height={60}
            className="object-cover w-full h-full"
            loading="lazy"
          />
        ) : (
          <span
            className="text-white font-bold text-lg"
            role="img"
            aria-label={`Profile initials for ${user.firstName} ${user.lastName}`}
          >
            {(
              [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || user.email[0]
            ).toUpperCase()}
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
          {formattedActionTime && user.status && !formattedInterval ? (
            <Status status={user.status.status}>{formattedActionTime}</Status>
          ) : null}
          {formattedInterval && user.status ? (
            <Status status={user.status.status}>{formattedInterval}</Status>
          ) : null}
          {formattedDates && user.status ? (
            <Status status={user.status.status}>{formattedDates}</Status>
          ) : null}
          {user.status?.sourceMessageKey ? (
            <a
              href={`/api/slack/message?key=${encodeURIComponent(user.status.sourceMessageKey)}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline text-link-blue hover:text-light-blue-hover"
            >
              View Slack message
            </a>
          ) : null}
        </div>
        {showStatus && user?.status?.details && (
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
