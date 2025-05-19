import ContactWrapper from './ContactWrapper';
import { UserWithExtras } from '@/db/types';
import { userService } from '@/lib/services/userService';

export default async function Home() {
  const users: UserWithExtras[] = await userService.getAllUsers();

  return <div>{users && <ContactWrapper users={users} />}</div>;
}
