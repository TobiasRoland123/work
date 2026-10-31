import Image from 'next/image';
import type { UserWithExtras } from '@/db/types';
import { getSlackImageUrl } from '@/lib/slack/image';
import { initials } from './presence';

export function Avatar({ person, size = 32 }: { person: UserWithExtras; size?: number }) {
  const picture = getSlackImageUrl(person.profilePicture);
  return (
    <span className="week-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {picture ? (
        <Image src={picture} alt="" width={size} height={size} unoptimized />
      ) : (
        initials(person)
      )}
    </span>
  );
}
