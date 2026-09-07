import { handlers } from '@/auth';

// Delegate to NextAuth's handler. Fetching this route from itself recurses.
export const { GET } = handlers;
