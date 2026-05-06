import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { logger } from '@/lib/logger';
import type { PageAccess, UserRole } from '@/types';
import { DEFAULT_PAGE_ACCESS } from '@/types';

// Routes that require authentication
const protectedRoutes = [
  '/admin',
  '/super-admin',
  '/management-dashboard',
  '/managers-dashboard',
  '/employee-reports',
  '/team-report',
  '/manage-team',
  '/employee-dashboard',
  '/holidays',
  '/mark-attendance',
  // '/work-report' - removed from protected routes to allow unauthenticated access
  '/profile',
];

// Map routes to page access keys
const ROUTE_TO_PAGE_ACCESS: Record<string, keyof PageAccess> = {
  '/employee-dashboard': 'dashboard',
  '/work-report': 'submit_report',
  '/employee-reports': 'employee_reports',
  '/team-report': 'employee_reports',
  '/manage-team': 'employee_reports',
  '/management-dashboard': 'management_dashboard',
  '/managers-dashboard': 'management_dashboard', // Uses same permission as management dashboard
  '/admin': 'admin_dashboard',
  '/super-admin': 'super_admin_dashboard',
  '/holidays': 'mark_holidays',
  '/mark-attendance': 'mark_attendance',
};

// Get JWT secret
function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    // In production, this should never happen, but we need a fallback for edge runtime
    if (process.env.NODE_ENV === 'production') {
      console.error('[MIDDLEWARE ERROR] JWT secret is not configured');
      throw new Error('JWT secret is not configured');
    }
    // Use fallback only in development
    return new TextEncoder().encode('fallback-secret-for-development');
  }
  return new TextEncoder().encode(secret);
}

// Get user's page access (from JWT or default based on role)
function getUserPageAccess(payload: { pageAccess?: PageAccess | null; role: UserRole }): PageAccess {
  if (payload.pageAccess) {
    return payload.pageAccess;
  }
  return DEFAULT_PAGE_ACCESS[payload.role] || DEFAULT_PAGE_ACCESS.employee;
}

// Check if user has access to a specific route
function hasRouteAccess(pathname: string, pageAccess: PageAccess): boolean {
  // Find matching route
  for (const [route, accessKey] of Object.entries(ROUTE_TO_PAGE_ACCESS)) {
    if (pathname.startsWith(route)) {
      return pageAccess[accessKey] === true;
    }
  }
  // Profile is always accessible for authenticated users
  if (pathname.startsWith('/profile')) {
    return true;
  }
  // Default to DENY for any new protected route that wasn't explicitly registered
  // above. This is the safer default — adding a new authenticated page should
  // require an explicit ROUTE_TO_PAGE_ACCESS entry (or update to /profile-style
  // exception) before users can reach it.
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Managers dashboard route is deprecated; use team-report instead.
  if (pathname.startsWith('/managers-dashboard')) {
    return NextResponse.redirect(new URL('/team-report', request.url));
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // If not a protected route, allow access
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const token = request.cookies.get('session')?.value;

  // If no token, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify token
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    // Check if user is active
    if (payload.status !== 'active') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'Account deactivated');
      return NextResponse.redirect(loginUrl);
    }

    const role = payload.role as UserRole;
    const pageAccess = getUserPageAccess({ 
      pageAccess: payload.pageAccess as PageAccess | null | undefined, 
      role 
    });

    // Check page access permissions
    if (!hasRouteAccess(pathname, pageAccess)) {
      // Redirect to home page if user doesn't have access
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Allow access
    return NextResponse.next();
  } catch (error) {
    // Log error for debugging (without exposing sensitive info)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('[MIDDLEWARE] Token verification failed:', errorMsg);
    // Invalid token, redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};

