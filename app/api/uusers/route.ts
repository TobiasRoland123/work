import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import 'next-auth';

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users?$filter=endswith(mail,'@charlietango.dk') and givenName ne null and jobTitle ne null&$count=true`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ConsistencyLevel: 'eventual',
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    console.error('Graph API fejl:', error);
    return NextResponse.json(
      { error: 'Microsoft Graph fejl', detail: error },
      { status: res.status }
    );
  }

  const userData = await res.json();

  return NextResponse.json(userData.value);
}
