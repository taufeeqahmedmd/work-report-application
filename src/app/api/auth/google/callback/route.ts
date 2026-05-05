import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getEmployeeByEmail } from '@/lib/db/queries';
import { setSessionCookie, employeeToSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/types';

// Get JWT secret for state token verification
function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not configured');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Verify state token
 */
async function verifyStateToken(token: string): Promise<string | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return (payload.state as string) || null;
  } catch {
    return null;
  }
}

/**
 * Exchange authorization code for access token
 */
async function getAccessToken(code: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google OAuth token exchange failed:', {
      status: response.status,
      statusText: response.statusText,
      error,
      redirectUri,
      clientId: clientId ? '***configured***' : 'NOT_CONFIGURED',
    });
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Get user profile from Google
 */
async function getGoogleUserProfile(accessToken: string): Promise<{ email: string; name: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile from Google');
  }

  const data = await response.json();
  return {
    email: data.email,
    name: data.name || data.email.split('@')[0],
  };
}

/**
 * Validate email domain against allowed domains
 */
function isEmailDomainAllowed(email: string): boolean {
  const allowedDomains = process.env.GOOGLE_ALLOWED_DOMAINS;

  if (!allowedDomains) {
    // If no domains are configured, allow all (not recommended for production)
    logger.warn('GOOGLE_ALLOWED_DOMAINS is not configured. Allowing all domains.');
    return true;
  }

  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain) {
    return false;
  }

  const allowedDomainsList = allowedDomains
    .split(',')
    .map(domain => domain.trim().toLowerCase())
    .filter(domain => domain.length > 0);

  return allowedDomainsList.includes(emailDomain);
}

/**
 * Get dashboard URL based on user role
 */
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'superadmin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'boardmember':
      return '/management-dashboard';
    case 'manager':
    case 'teamhead':
    case 'employee':
    default:
      return '/employee-dashboard';
  }
}

/**
 * GET: Handle Google OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const callbackUrl = searchParams.get('callbackUrl');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('Google authentication was cancelled or failed')}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/login?error=Invalid+OAuth+response', request.url)
      );
    }

    // Verify state token (CSRF protection)
    const statePayload = await verifyStateToken(state);
    if (!statePayload) {
      return NextResponse.redirect(
        new URL('/login?error=Invalid+or+expired+state+token', request.url)
      );
    }

    // Exchange code for access token
    const accessToken = await getAccessToken(code);

    // Get user profile from Google
    const googleUser = await getGoogleUserProfile(accessToken);

    // Validate email domain
    if (!isEmailDomainAllowed(googleUser.email)) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent('Your email domain is not authorized to access this application')}`,
          request.url
        )
      );
    }

    // Look up user in database by email
    const employee = await getEmployeeByEmail(googleUser.email);

    if (!employee) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent('No account found with this email. Please contact your administrator.')}`,
          request.url
        )
      );
    }

    // Check if employee is active
    if (employee.status !== 'active') {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent('Your account has been deactivated. Please contact administrator.')}`,
          request.url
        )
      );
    }

    // Create session
    const sessionUser = employeeToSessionUser(employee);
    await setSessionCookie(sessionUser);

    // Determine redirect URL
    let redirectUrl = callbackUrl || getDashboardUrl(employee.role);

    // Ensure redirectUrl is a valid absolute URL or path
    try {
      // Test if it's already a valid absolute URL
      new URL(redirectUrl);
    } catch {
      // If not a valid URL, assume it's a path and make it absolute relative to the app URL
      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      redirectUrl = new URL(redirectUrl, appBaseUrl).toString();
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    // Log full error details server-side only
    console.error('Google OAuth callback error:', error);
    if (error instanceof Error) {
      console.error('Error details:', { message: error.message, stack: error.stack });
    }
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('An unexpected error occurred during authentication. Please try again.')}`,
        request.url
      )
    );
  }
}

