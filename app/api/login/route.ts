import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { userService } from '@/lib/services/userService';

// Define session options - move this to a shared config file in production
const sessionOptions = {
  cookieName: 'user_session',
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  },
};

// Define session type
export type SessionData = {
  userId: number;
  email: string;
  role: string;
  isLoggedIn: boolean;
};

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    try {
      // Use the userService to validate credentials
      const user = await userService.loginUser(email, password);

      // Create and set session using iron-session
      const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

      // Update session data
      session.userId = user.id;
      session.email = user.email;
      session.role = user.systemRole;
      session.isLoggedIn = true;

      // Save session
      await session.save();

      // Return user information (excluding password)
      const { password: _password, ...userWithoutPassword } = user;
      void _password; //ignore this

      return NextResponse.json({
        user: userWithoutPassword,
        success: true,
      });
    } catch (error: unknown) {
      // Handle specific errors from userService
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        } else if (error.message === 'Invalid credentials') {
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }
      }
      throw error; // Re-throw unexpected errors
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
