import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pool, initializeDatabase } from '@/lib/db/database';
import type { ApiResponse } from '@/types';

// POST: Run database migrations (superadmin only)
export async function POST() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'superadmin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only superadmins can run migrations' },
        { status: 403 }
      );
    }

    // Initialize/update database schema
    await initializeDatabase();

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Database migrations completed successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Migration failed. Check server logs for details.' },
      { status: 500 }
    );
  }
}

// GET: Check migration status
export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'superadmin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only superadmins can check migrations' },
        { status: 403 }
      );
    }

    // Check which tables exist in PostgreSQL
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const tableNames = result.rows.map((row: { table_name: string }) => row.table_name);

    const status = {
      departments: tableNames.includes('departments'),
      manager_departments: tableNames.includes('manager_departments'),
      entities: tableNames.includes('entities'),
      branches: tableNames.includes('branches'),
      employees: tableNames.includes('employees'),
      work_reports: tableNames.includes('work_reports'),
      settings: tableNames.includes('settings'),
      password_reset_tokens: tableNames.includes('password_reset_tokens'),
      otp_tokens: tableNames.includes('otp_tokens'),
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Migration status error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
