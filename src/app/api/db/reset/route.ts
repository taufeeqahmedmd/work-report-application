import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db/database';
import { logger } from '@/lib/logger';

// Reset key from environment variable (for production safety)
const RESET_KEY = process.env.DB_RESET_KEY;

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resetKey = searchParams.get('key');

    // Only allow superadmin to reset database (reset key disabled in production)
    const session = await getSession();
    const hasValidKey = RESET_KEY && resetKey === RESET_KEY;

    if (!hasValidKey && (!session || session.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Only superadmin can reset the database' },
        { status: 403 }
      );
    }

    // Get the super admin user ID to preserve it
    const superAdminResult = await pool.query(
      "SELECT id FROM employees WHERE role = 'superadmin' LIMIT 1"
    );

    if (superAdminResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Super admin not found' },
        { status: 400 }
      );
    }

    const superAdminId = superAdminResult.rows[0].id;

    // Delete in order to respect foreign key constraints

    // 1. Delete all work reports
    await pool.query('DELETE FROM work_reports');

    // 2. Delete all manager_departments mappings
    await pool.query('DELETE FROM manager_departments');

    // 3. Delete all OTP tokens
    await pool.query('DELETE FROM otp_tokens');

    // 4. Delete all password reset tokens
    await pool.query('DELETE FROM password_reset_tokens');

    // 5. Delete all users except super admin
    await pool.query('DELETE FROM employees WHERE id != $1', [superAdminId]);

    // 6. Delete all departments
    await pool.query('DELETE FROM departments');

    // 7. Delete all branches
    await pool.query('DELETE FROM branches');

    // 8. Delete all entities
    await pool.query('DELETE FROM entities');

    return NextResponse.json({
      success: true,
      message: 'Database reset successfully. All data deleted except super admin.',
    });
  } catch (error) {
    logger.error('Database reset error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset database',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST request to reset the database. Warning: This will delete all data except super admin!',
  });
}
