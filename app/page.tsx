import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function Home() {
  const session = await auth();

  const isValid = session?.user && (!session.expires || new Date(session.expires) > new Date());

  if (isValid) {
    redirect('/today');
  } else {
    redirect('/login');
  }

  return null;
}
