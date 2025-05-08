import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    console.error('Ingen accessToken i session');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('Graph API fejl:', error);
    return NextResponse.json(
      { error: 'Microsoft Graph fejl', detail: error },
      { status: res.status }
    );
  }

  const user = await res.json();

  return NextResponse.json(user);
}
