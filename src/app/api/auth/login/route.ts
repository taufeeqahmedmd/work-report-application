import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, setSessionCookie, employeeToSessionUser } from '@/lib/auth';
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts, getClientIp } from '@/lib/rate-limiter';
import type { LoginCredentials, ApiResponse, SafeEmployee, PageAccess } from '@/types';
import { DEFAULT_PAGE_ACCESS } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: LoginCredentials = await request.json();
    const { employeeId, password } = body;

    // Validate input
    if (!employeeId || !password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Employee ID and password are required',
        },
        { status: 400 }
      );
    }

    // --- Rate Limiting ---
    const clientIp = getClientIp(request.headers);
    const rateLimit = checkLoginRateLimit(clientIp, employeeId);

    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: rateLimit.reason || 'Too many login attempts. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // Authenticate user
    const result = await authenticateUser({ employeeId, password });

    if (!result.success || !result.user) {
      // Record failed attempt
      recordFailedLogin(clientIp, employeeId);

      // Check remaining attempts after recording
      const updatedLimit = checkLoginRateLimit(clientIp, employeeId);
      const attemptsWarning = updatedLimit.remainingAttempts <= 2 && updatedLimit.remainingAttempts > 0
        ? ` ${updatedLimit.remainingAttempts} attempt(s) remaining before lockout.`
        : '';

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: (result.error || 'Authentication failed') + attemptsWarning,
        },
        { status: 401 }
      );
    }

    // Successful login — clear rate limit for this employee ID
    clearLoginAttempts(employeeId);

    // Create session
    const sessionUser = employeeToSessionUser(result.user);

    try {
      await setSessionCookie(sessionUser);
    } catch (cookieError) {
      console.error('[LOGIN ERROR] Failed to set session cookie:', cookieError);
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Failed to create session. Please try again.',
        },
        { status: 500 }
      );
    }

    // Parse pageAccess from JSON string or use default based on role
    let pageAccess: PageAccess | null = null;
    if (result.user.pageAccess) {
      try {
        pageAccess = JSON.parse(result.user.pageAccess) as PageAccess;
      } catch {
        pageAccess = DEFAULT_PAGE_ACCESS[result.user.role];
      }
    } else {
      pageAccess = DEFAULT_PAGE_ACCESS[result.user.role];
    }

    // Return user data (without password)
    const safeUser: SafeEmployee = {
      id: result.user.id,
      employeeId: result.user.employeeId,
      name: result.user.name,
      email: result.user.email,
      department: result.user.department,
      entityId: result.user.entityId,
      branchId: result.user.branchId,
      role: result.user.role,
      status: result.user.status,
      pageAccess,
      createdBy: result.user.createdBy,
      createdAt: result.user.createdAt,
      updatedAt: result.user.updatedAt,
    };

    const response = NextResponse.json<ApiResponse<SafeEmployee>>({
      success: true,
      data: safeUser,
      message: 'Login successful',
    });

    // Ensure cookies are included in response headers
    // The cookies() API should handle this automatically, but we verify
    return response;
  } catch (error) {
    console.error('[LOGIN ERROR]', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'An error occurred during login. Please try again.',
      },
      { status: 500 }
    );
  }
}
