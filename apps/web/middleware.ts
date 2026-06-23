import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight gate for /dashboard: redirect to /login when no NextAuth session
 * cookie is present. We check the cookie here (edge-safe, no DB/provider import)
 * and enforce real authorization server-side in the page via `auth()`.
 */
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token');

  if (!hasSession) {
    const url = new URL('/login', req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
