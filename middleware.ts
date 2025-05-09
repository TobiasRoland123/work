import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from './utils/validateSession';
import { auth } from './auth';

// Single public path
const PUBLIC_PATH = '/login';

// Single protected path
const PROTECTED_PATH = '/today';

// Protected API paths
const PROTECTED_API_PATHS = ['/api/uuser', '/api/me', '/api/auth/session'];

export async function middleware(request: NextRequest) {
  // Check if the path is the login page
  const isLoginPage = request.nextUrl.pathname === PUBLIC_PATH;

  // Check if the path is a protected API route
  const isProtectedApi = PROTECTED_API_PATHS.includes(request.nextUrl.pathname);

  const authData = await auth();

  // Create a response object we'll use for redirection if needed
  const response = NextResponse.next();

  try {
    // Get the iron session
    const ironSession = await getIronSession<SessionData>(request, response, sessionOptions);

    // User is authenticated if either Auth.js has a user OR iron session is logged in
    const isAuthenticated = !!authData?.user || ironSession.isLoggedIn;

    // If user is not logged in and trying to access a protected API route
    if (!isAuthenticated && isProtectedApi) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // If user is not logged in and trying to access a protected route
    if (!isAuthenticated && !isLoginPage) {
      const url = new URL(PUBLIC_PATH, request.url);
      return NextResponse.redirect(url);
    }

    // If user is logged in and trying to access login page
    if (isAuthenticated && isLoginPage) {
      const url = new URL(PROTECTED_PATH, request.url);
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error('Middleware authentication error:', error);

    // Return 401 for protected API routes on error
    if (isProtectedApi) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // On error, redirect non-public paths to login
    if (!isLoginPage) {
      const url = new URL(PUBLIC_PATH, request.url);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - other api routes (starting with /api/ but not in our protected list)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api/(?!uuser|me|auth/session)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/api/uuser',
    '/api/me',
    '/api/auth/session',
  ],
};
