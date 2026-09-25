import { auth } from '@/auth';
import { cache } from 'react';
export async function requireUserId() {
  const session = await auth();
  if (session?.provider !== 'slack' || !session.userId) throw new Error('Unauthorized');
  return session.userId;
}

// Layouts and pages share one membership check per server render, never across requests.
export const requirePageUserId = cache(async () => {
  const { redirect } = await import('next/navigation');
  try {
    return await requireUserId();
  } catch {
    return redirect('/login');
  }
});
