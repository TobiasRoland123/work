import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/userService';

export async function GET() {
  const session = await auth();

  if (session?.provider !== 'slack' || !session.userId)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const user = await userService.getUserById(session.userId);
  return user
    ? NextResponse.json(user)
    : NextResponse.json({ error: 'User not found' }, { status: 404 });
}
