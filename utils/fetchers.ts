export const fetchUsers = async () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'GET',
    headers: {
      'Content-type': 'application/json',
    },
    cache: 'no-store', // Prevents caching for fresh data
  });
  if (!res.ok) {
    throw new Error('Failed to fetch users');
  }
  return res.json();
};
