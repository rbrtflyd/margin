import { NextResponse } from 'next/server';
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';
import { isConvexConfigured } from '@/lib/env';

const isAuthPage = createRouteMatcher(['/auth/sign-in', '/auth/sign-up']);
const isPublic = createRouteMatcher(['/auth/sign-in', '/auth/sign-up', '/api/ask']);

function passThrough() {
  return NextResponse.next();
}

export default isConvexConfigured()
  ? convexAuthNextjsMiddleware(
      async (request, { convexAuth }) => {
        if (isAuthPage(request) && (await convexAuth.isAuthenticated())) {
          return nextjsMiddlewareRedirect(request, '/');
        }
        if (isPublic(request)) return;
        if (!(await convexAuth.isAuthenticated())) {
          return nextjsMiddlewareRedirect(request, '/auth/sign-in');
        }
      },
      { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
    )
  : passThrough;

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
