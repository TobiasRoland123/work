import { getSession } from '@/utils/validateSession';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getSession();

  if (session.isLoggedIn) {
    redirect('/today');
  } else {
    redirect('/login');
  }

  return null;
}
