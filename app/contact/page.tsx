import { requirePageUserId } from '@/lib/auth/require-user';
import ContactWrapper from './ContactWrapper';
import { UserWithExtras } from '@/db/types';
import { userService } from '@/lib/services/userService';

export const dynamic = 'force-dynamic';

export default async function Home() {
  await requirePageUserId();
  const users: UserWithExtras[] = await userService.getAllUsers(false);

  return <div>{users && <ContactWrapper users={users} />}</div>;
}
