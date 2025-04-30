import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from './utils/validateSession';

// Single public path
const PUBLIC_PATH = '/login';

// Single protected path
const PROTECTED_PATH = '/today';

export async function middleware(request: NextRequest) {
  // Check if the path is the login page
  const isLoginPage = request.nextUrl.pathname === PUBLIC_PATH;

  // Create a response object we'll use for redirection if needed
  const response = NextResponse.next();

  try {
    // Get the session using iron-session
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    // If user is not logged in and trying to access a protected route
    if (!session.isLoggedIn && !isLoginPage) {
      const url = new URL(PUBLIC_PATH, request.url);
      return NextResponse.redirect(url);
    }

    // If user is logged in and trying to access login page
    if (session.isLoggedIn && isLoginPage) {
      const url = new URL(PROTECTED_PATH, request.url);
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error('Middleware authentication error:', error);

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
     * - api routes (starting with /api/)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
