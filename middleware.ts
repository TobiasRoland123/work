import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from './auth.config';

// This configuration has no database imports and can run at the Edge.
const { auth } = NextAuth(authConfig);
const serviceRoutes = [
  '/api/check-users',
  '/api/slack/events',
  '/api/slack/process',
  '/api/slack/install',
  '/api/slack/install/callback',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // These endpoints perform their own signature/secret checks, without session redirects.
  if (
    serviceRoutes.includes(pathname) ||
    pathname === '/api/auth' ||
    pathname.startsWith('/api/auth/')
  )
    return NextResponse.next();
  let session;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  const authenticated =
    session?.provider === 'slack' &&
    Boolean(session.userId) &&
    (!session.expires || new Date(session.expires).getTime() > Date.now());
  if (pathname === '/')
    return NextResponse.redirect(new URL(authenticated ? '/today' : '/login', request.url));
  if (pathname === '/login') return NextResponse.next();
  if (!authenticated) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
