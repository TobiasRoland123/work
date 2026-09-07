import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services/userService';

export async function GET() {
  const session = await auth();

  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(await userService.getAllUsers());
}
