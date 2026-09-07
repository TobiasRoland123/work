import { userService } from '@/lib/services/userService';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (session?.provider !== 'slack' || !session.userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await userService.getAllUsers());
}
// User creation and identity linking are owned by Slack sign-in and directory sync.
