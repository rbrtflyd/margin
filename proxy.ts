import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';

// Next.js 16 proxy (formerly middleware). Sends signed-out visitors to the sign-in page.
// API routes and the auth pages are excluded: /api/ask checks the session itself and answers with JSON.
function passThrough() {
  return NextResponse.next();
}

export default auth ? auth.middleware({ loginUrl: '/auth/sign-in' }) : passThrough;

export const config = {
  matcher: ['/((?!api|auth|_next/static|_next/image|favicon.ico).*)'],
};
