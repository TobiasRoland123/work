import { UserWithExtras } from '@/db/types';
import { ProfileListItem } from '../ProfileListItem/ProfileListItem';
import { cn } from '@/lib/className';

type ProfileListProps = {
  profiles: UserWithExtras[];
  showStatus?: boolean;
};

export function ProfileList({ profiles, showStatus = false }: ProfileListProps) {
  return (
    <ul className={cn(showStatus ? 'pb-24' : '', 'grid grid-cols-1 lg:grid-cols-2')} role="list">
      {profiles.map((profile, index) => (
        <li
          key={index}
          className={`border-b border-gray-400 pb-1 ${
            index === profiles.length - 1 && profiles.length % 2 === 1 ? 'lg:col-span-2' : ''
          }`}
        >
          <ProfileListItem user={profile} showStatus={showStatus} />
        </li>
      ))}
    </ul>
  );
}
