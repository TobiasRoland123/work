import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

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

    // Find user by email
    const user = await db?.select().from(users).where(eq(users.email, email)).limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user[0].password || '');

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create and set session using iron-session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    // Update session data
    session.userId = user[0].id;
    session.email = user[0].email;
    session.role = user[0].systemRole;
    session.isLoggedIn = true;

    // Save session
    await session.save();

    // Return user information (excluding password)
    const { password: _password, ...userWithoutPassword } = user[0];
    void _password; //ignore this

    return NextResponse.json({
      user: userWithoutPassword,
      success: true,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
