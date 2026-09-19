import { auth } from '@/auth';
export async function requireUserId() {
  const session = await auth();
  if (session?.provider !== 'slack' || !session.userId) throw new Error('Unauthorized');
  return session.userId;
}

export async function requirePageUserId() {
  const { redirect } = await import('next/navigation');
  try {
    return await requireUserId();
  } catch {
    return redirect('/login');
  }
}
