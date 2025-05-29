import { cookies } from 'next/headers';
import { auth as nextAuth } from '@/auth';

const auth = async () => {
  const mockUserId = (await cookies()).get('x-mock-user-id')?.value;
  if (mockUserId) {
    return {
      userId: mockUserId,
    };
  }
  return nextAuth();
};

export default auth;
