import { UserWithExtras } from '@/db/types';
import { PeopleOverviewWrapper } from './PeopleOverviewWrapper';
import { userService } from '@/lib/services/userService';

export default async function Home() {
  const users: UserWithExtras[] = await userService.getAllUsers();

  return (
    <div>
      <PeopleOverviewWrapper initialProfiles={users} initialOfficeStatus />
    </div>
  );
}
