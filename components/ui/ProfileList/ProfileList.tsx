import { ProfileListItem, ProfileListItemProps } from '../ProfileListItem/ProfileListItem';

type ProfileListProps = {
  profiles: ProfileListItemProps[];
};

export function ProfileList({ profiles }: ProfileListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      {profiles.map((profile, index) => (
        <div
          key={index}
          className={`border-b border-gray-400 pb-1 ${
            index === profiles.length - 1 && profiles.length % 2 === 1 ? 'md:col-span-2' : ''
          }`}
        >
          <ProfileListItem {...profile} />
        </div>
      ))}
    </div>
  );
}
