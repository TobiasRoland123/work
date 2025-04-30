import { getSession } from '@/utils/validateSession';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const session = await getSession();
    // Clear session data
    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
