import Image from 'next/image';
import { Status, StatusType } from '../Status/Status';

export type ProfileListItemProps = {
  profilePicture?: string;
  name: string;
  title: string;
  status: StatusType;
  phoneNumber: string;
  email: string;
};

export function ProfileListItem({
  profilePicture,
  name,
  title,
  status,
  phoneNumber,
  email,
}: ProfileListItemProps) {
  return (
    <div className="flex items-center gap-3 px-2 py-1 border-gray-400">
      {profilePicture ? (
        <Image
          src={profilePicture}
          alt={`Profile picture of ${name}`}
          width={60}
          height={1}
          className="rounded-full relative bottom-2"
        />
      ) : (
        <div
          className="size-15 bg-gray-400 rounded-full flex items-center justify-center relative bottom-2"
          role="img"
          aria-label={`Default profile picture for ${name}`}
        ></div>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-24 leading-[30px] font-mono">{name}</h2>
        <div className="flex items-center gap-2">
          <p className="text-[16px]">{title}</p>
          <Status status={status} />
        </div>
        <div className="flex gap-2">
          <a
            href={`tel:${phoneNumber}`}
            className="text-[16px] font-sans font-light leading-5 underline text-link-blue hover:text-light-blue-hover"
          >
            {phoneNumber}
          </a>
          <a
            href={`mailto:${email}`}
            className="text-[16px] font-sans font-light leading-5 underline text-link-blue hover:text-light-blue-hover"
          >
            {email}
          </a>
        </div>
      </div>
    </div>
  );
}
