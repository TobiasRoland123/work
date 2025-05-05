import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

// Define session type
export type SessionData = {
  userId?: number;
  email?: string;
  role?: string;
  isLoggedIn: boolean;
};

// Session options - consistent with your login route
export const sessionOptions = {
  cookieName: 'user_session',
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  },
};

// Function to get the current session
export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  // Initialize session if it doesn't exist
  if (!session.isLoggedIn) {
    session.isLoggedIn = false;
  }

  return session;
}
