import { auth } from '@/auth';
import { userService } from '@/lib/services/userService';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const user = await userService.getUserById(session.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json(user);
}
