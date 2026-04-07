import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/logout']);

export function middleware(request: NextRequest) {
  const token = request.cookies.get('erp_access_token')?.value;
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === '/login' && token) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
