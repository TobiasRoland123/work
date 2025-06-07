import { auth } from '@/auth';

export const fetchData = async (params: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const session = await auth();
  const headers: Record<string, string> = {
    'Content-type': 'application/json',
  };

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const res = await fetch(`${baseUrl}/api/${params}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${params}`);
  }
  return res.json();
};

export const sendData = async <T>({ params, body }: { params: string; body: T }) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/${params}`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${params}`);
  }
  return res.json();
};
