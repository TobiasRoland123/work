import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './auth';

// Define public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/auth/session',
  // Add any other public routes here
];

// Route to redirect to when authenticated user tries to access public routes
const DEFAULT_AUTH_REDIRECT = '/today';

// Route to redirect to when unauthenticated user tries to access protected routes
const DEFAULT_UNAUTH_REDIRECT = '/login';

export async function middleware(request: NextRequest) {
  // E2E test bypass: short-circuit all auth logic if header is present
  if (request.headers.get(`x-e2e-test-bypass${process.env.BYPASS_SECRET}`) === 'true') {
    const response = NextResponse.next();
    response.cookies.set('x-mock-user-id', 'test-user-uuid', { path: '/' });
    return response;
  }

  const pathname = request.nextUrl.pathname;
  let authData;
  try {
    authData = await auth();
  } catch (error) {
    console.error('Error during authentication:', error);

    // Return 401 for API routes on error
    if (pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Redirect to login page if not already on a public path
    const isPublicPath = PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
    if (!isPublicPath) {
      const url = new URL(DEFAULT_UNAUTH_REDIRECT, request.url);
      return NextResponse.redirect(url);
    }
  }
  const isAuthenticated = authData?.user;

  // Check if the current path is public
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const isExemptApiEndpoint = pathname === '/api/auth/session';

  // Check if the path is an API route
  const isApiRoute = pathname.startsWith('/api/');

  // Create a response object we'll use for redirection if needed
  const response = NextResponse.next();

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(isAuthenticated ? DEFAULT_AUTH_REDIRECT : DEFAULT_UNAUTH_REDIRECT, request.url)
    );
  }

  try {
    // Check if session has expired
    let isSessionExpired = false;
    if (authData?.expires) {
      const now = Date.now();
      const expiresAt = new Date(authData.expires).getTime();
      isSessionExpired = expiresAt < now;
    }

    // Protect API routes that aren't explicitly public
    if (isApiRoute && !isPublicPath) {
      // Block direct browser access to API endpoints
      if (request.headers.get('sec-fetch-dest') === 'document') {
        return new NextResponse(
          JSON.stringify({ error: 'API endpoints cannot be accessed directly from browser' }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Return 401 for unauthenticated API requests
      if (!isAuthenticated) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // If user is authenticated but session is expired, force re-login
    if (isAuthenticated && isSessionExpired) {
      const url = new URL(DEFAULT_UNAUTH_REDIRECT, request.url);
      return NextResponse.redirect(url);
    }

    // If user is not logged in and trying to access a protected route
    if (!isAuthenticated && !isPublicPath) {
      const url = new URL(DEFAULT_UNAUTH_REDIRECT, request.url);
      return NextResponse.redirect(url);
    }

    // If user is logged in and trying to access a public-only path
    if (isAuthenticated && !isSessionExpired && isPublicPath && !isExemptApiEndpoint) {
      const url = new URL(DEFAULT_AUTH_REDIRECT, request.url);
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error('Middleware authentication error:', error);

    // Return 401 for API routes on error
    if (isApiRoute) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // On error, redirect to login page if not already on a public path
    if (!isPublicPath) {
      const url = new URL(DEFAULT_UNAUTH_REDIRECT, request.url);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

// Configure the middleware to run on all paths except static assets
export const config = {
  matcher: [
    // Apply to all routes except for static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
