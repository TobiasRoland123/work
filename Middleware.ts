import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const cookie = request.cookies.get('open');

  // If cookie is missing or invalid, set a default
  if (!cookie || !['navigation', 'status'].includes(cookie.value)) {
    response.cookies.set('open', 'navigation', {
      path: '/',
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'], // match all routes except static
};
