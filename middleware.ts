import NextAuth, { type Session } from 'next-auth';
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
  type NextMiddleware,
} from 'next/server';
import { authConfig } from './auth.config';
import { isSandbox } from './lib/sandbox/enabled';

// This configuration has no database imports and can run at the Edge.
const { auth } = NextAuth({
  ...authConfig,
  // Route access below preserves the app's login redirects and API 401 responses.
  callbacks: { ...authConfig.callbacks, authorized: () => true },
});
// Installation assets must also be available before a user signs in.
const publicPwaRoutes = ['/manifest.webmanifest', '/sw.js', '/offline.html'];

const serviceRoutes = [
  '/api/check-users',
  '/api/echoes',
  '/api/slack/events',
  '/api/queues/slack-status',
  '/api/slack/process',
  '/api/slack/install',
  '/api/slack/install/callback',
];

function routeRequest(request: NextRequest, session: Session | null) {
  const pathname = request.nextUrl.pathname;
  // Next's dev server can expose its internal localhost origin behind a tunnel.
  const redirectOrigin =
    process.env.NODE_ENV === 'development' && process.env.AUTH_URL
      ? process.env.AUTH_URL
      : request.url;
  const authenticated =
    session?.provider === 'slack' &&
    Boolean(session.userId) &&
    (!session.expires || new Date(session.expires).getTime() > Date.now());
  if (pathname === '/')
    return NextResponse.redirect(new URL(authenticated ? '/today' : '/login', redirectOrigin));
  if (pathname === '/login') return NextResponse.next();
  if (!authenticated) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', redirectOrigin));
  }
  return NextResponse.next();
}

// The wrapper copies Auth.js's renewed session cookie onto every response,
// including redirects. A read-only auth() call cannot persist that renewal.
// This Auth.js beta types the wrapper as a route handler, although its runtime
// also accepts NextMiddleware and forwards NextFetchEvent unchanged.
const authenticatedMiddleware = auth((request) =>
  routeRequest(request, request.auth)
) as unknown as NextMiddleware;

export async function middleware(request: NextRequest, event?: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  if (publicPwaRoutes.includes(pathname)) return NextResponse.next();
  // Service endpoints validate signatures/secrets; the queue consumer is private on Vercel.
  // None of these callbacks should be redirected to interactive login.
  if (
    serviceRoutes.includes(pathname) ||
    pathname === '/api/auth' ||
    pathname.startsWith('/api/auth/')
  )
    return NextResponse.next();
  // The Local Sandbox is reachable without a session, but only outside production builds.
  if (isSandbox() && pathname.startsWith('/sandbox')) return NextResponse.next();
  try {
    return (await authenticatedMiddleware(request, event!)) ?? NextResponse.next();
  } catch {
    return routeRequest(request, null);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
