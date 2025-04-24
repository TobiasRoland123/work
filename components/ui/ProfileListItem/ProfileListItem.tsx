import Image from 'next/image';
import { Status, StatusProps } from '../Status/Status';

export type ProfileListItemProps = {
  profilePicture?: string;
  name: string;
  title: string;
  status: StatusProps;
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
          alt="Profile picture"
          width={60}
          height={1}
          className="rounded-full relative bottom-2"
        />
      ) : (
        <div className="size-15 bg-gray-400 rounded-full flex items-center justify-center relative bottom-2"></div>
      )}
      {/* Profile picture */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font">{name}</h2>
        <div className="flex items-center gap-2">
          <p className="text-sm">{title}</p>
          <Status message={status.message} absent={status.absent} />
        </div>
        <div className="flex gap-2">
          <p className="text-sm underline text-blue-600">{phoneNumber}</p>
          <p className="text-sm underline text-blue-600">{email}</p>
        </div>
      </div>
    </div>
  );
}
