import { NextResponse } from 'next/server';
import { pool, getPoolHealth } from '@/lib/db/database';
import { getSession } from '@/lib/auth';
import type { ApiResponse } from '@/types';

/**
 * GET /api/debug/db
 * Database connection diagnostic endpoint
 * RESTRICTED: Superadmin only
 */
export async function GET() {
  try {
    // Authentication guard - superadmin only
    const session = await getSession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 1. Check pool health
    const poolHealth = getPoolHealth();

    // 2. Try simple SELECT 1
    const start = performance.now();
    await pool.query('SELECT 1');
    const duration = performance.now() - start;

    // 3. Check if key tables exist (without exposing full table list)
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    const requiredTables = ['employees', 'work_reports', 'departments', 'entities', 'branches'];
    const tableStatus: Record<string, boolean> = {};
    for (const table of requiredTables) {
      tableStatus[table] = tables.includes(table);
    }

    // 4. Check employee count (without exposing details)
    let employeesCount: number | string = 'Table not found';
    if (tables.includes('employees')) {
      try {
        const countRes = await pool.query('SELECT COUNT(*) FROM employees');
        employeesCount = parseInt(countRes.rows[0].count);
      } catch {
        employeesCount = 'Error counting employees';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection diagnostic',
      poolHealth,
      connectionDuration: `${duration.toFixed(2)}ms`,
      tableStatus,
      employeesCount,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_CONFIGURED: !!process.env.DATABASE_URL,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Log full error server-side only
    console.error('[DEBUG/DB] Diagnostic error:', error);
    return NextResponse.json({
      success: false,
      error: 'Database diagnostic failed',
      env: {
        DATABASE_URL_CONFIGURED: !!process.env.DATABASE_URL
      }
    }, { status: 500 });
  }
}
