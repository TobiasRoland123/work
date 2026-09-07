import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import authConfig from './auth.config';

const { auth: edgeAuth } = NextAuth(authConfig);
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/check-users', '/api/slack/sync'];
const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export const middleware = edgeAuth((request) => {
  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);
  const authenticated = Boolean(request.auth?.userId);

  if (pathname === '/') {
    return NextResponse.redirect(new URL(authenticated ? '/today' : '/login', request.url));
  }
  if (pathname.startsWith('/api/') && !publicPath && !authenticated) {
    return NextResponse.json({ error: 'Unauthorized, is not authenticated' }, { status: 401 });
  }
  if (!authenticated && !publicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (authenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/today', request.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
