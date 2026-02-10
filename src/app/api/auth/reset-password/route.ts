import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { checkResetPasswordRateLimit, recordResetPasswordAttempt, getClientIp } from '@/lib/rate-limiter';
import {
  getEmployeeByEmployeeId,
  getEmployeeByEmail,
  createPasswordResetToken,
  getPasswordResetToken,
  deletePasswordResetToken,
  updateEmployeePassword
} from '@/lib/db/queries';
import type { ApiResponse } from '@/types';

// POST: Request password reset (generates token)
export async function POST(request: NextRequest) {
  try {
    // --- Rate Limiting ---
    const clientIp = getClientIp(request.headers);
    const rateLimit = checkResetPasswordRateLimit(clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: rateLimit.reason || 'Too many password reset requests. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // Record this attempt
    recordResetPasswordAttempt(clientIp);

    const body = await request.json();
    const { employeeId, email } = body;

    // Find employee by ID or email
    let employee = null;
    if (employeeId) {
      employee = await getEmployeeByEmployeeId(employeeId);
    } else if (email) {
      employee = await getEmployeeByEmail(email);
    }

    if (!employee) {
      // Don't reveal if user exists
      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'If an account exists with this information, a password reset link will be sent.',
      });
    }

    if (employee.status !== 'active') {
      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'If an account exists with this information, a password reset link will be sent.',
      });
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    // Store token
    await createPasswordResetToken(employee.employeeId, token, expiresAt);

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(employee.email, token, employee.name);

    if (!emailSent) {
      console.error(`[Password Reset] Failed to send email to ${employee.email}`);
    } else {
      logger.info(`[Password Reset] Email sent to ${employee.email}`);
    }

    // Mask email for response (show first 2 chars and domain)
    const maskedEmail = employee.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `If an account exists, a password reset link has been sent to ${maskedEmail}`,
      // In development, include the token for testing (remove in production if needed)
      ...(process.env.NODE_ENV === 'development' && { data: { token, resetUrl: `/reset-password?token=${token}` } }),
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

// PUT: Reset password with token
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Find token
    const resetToken = await getPasswordResetToken(token);

    if (!resetToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date(resetToken.expiresAt) < new Date()) {
      await deletePasswordResetToken(token);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    const updated = await updateEmployeePassword(resetToken.employeeId, hashedPassword);

    if (!updated) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Delete used token
    await deletePasswordResetToken(token);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}

// GET: Verify token validity
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const resetToken = await getPasswordResetToken(token);

    if (!resetToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    if (new Date(resetToken.expiresAt) < new Date()) {
      await deletePasswordResetToken(token);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Token is valid',
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to verify token' },
      { status: 500 }
    );
  }
}
