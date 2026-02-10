import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/database';
import { getSession } from '@/lib/auth';
import type { ApiResponse } from '@/types';

/**
 * GET /api/db/test-query
 * Tests basic database queries to diagnose issues
 * RESTRICTED: Superadmin only
 */
export async function GET() {
  // Authentication guard - superadmin only
  const session = await getSession();
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    );
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // Test 1: Simple connection
  try {
    const r1 = await pool.query('SELECT 1 as test');
    results.tests = {
      ...results.tests as object,
      connection: { success: true, result: r1.rows[0] },
    };
  } catch {
    results.tests = {
      ...results.tests as object,
      connection: { success: false, error: 'Connection test failed' },
    };
  }

  // Test 2: Check if work_reports table exists
  try {
    const r2 = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'work_reports'
      ) as exists
    `);
    results.tests = {
      ...results.tests as object,
      tableExists: { success: true, exists: r2.rows[0].exists },
    };
  } catch {
    results.tests = {
      ...results.tests as object,
      tableExists: { success: false, error: 'Table check failed' },
    };
  }

  // Test 3: Check work_reports column count (without exposing column names/types)
  try {
    const r3 = await pool.query(`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_name = 'work_reports'
    `);
    results.tests = {
      ...results.tests as object,
      tableSchema: { success: true, columnCount: parseInt(r3.rows[0].column_count) },
    };
  } catch {
    results.tests = {
      ...results.tests as object,
      tableSchema: { success: false, error: 'Schema check failed' },
    };
  }

  // Test 4: Count work_reports
  try {
    const r4 = await pool.query('SELECT COUNT(*) as count FROM work_reports');
    results.tests = {
      ...results.tests as object,
      workReportsCount: { success: true, count: parseInt(r4.rows[0].count) },
    };
  } catch {
    results.tests = {
      ...results.tests as object,
      workReportsCount: { success: false, error: 'Count query failed' },
    };
  }

  // Test 5: Check if work_reports has data (without exposing sample data)
  try {
    const r5 = await pool.query('SELECT COUNT(*) as count FROM work_reports LIMIT 1');
    results.tests = {
      ...results.tests as object,
      workReportsData: {
        success: true,
        hasData: parseInt(r5.rows[0].count) > 0,
      },
    };
  } catch {
    results.tests = {
      ...results.tests as object,
      workReportsData: { success: false, error: 'Data check failed' },
    };
  }

  // Test 6: Check employees table
  try {
    const r6 = await pool.query('SELECT COUNT(*) as count FROM employees');
    results.tests = {
      ...results.tests as object,
      employeesCount: { success: true, count: parseInt(r6.rows[0].count) },
    };
  } catch {
    results.tests = {
      ...results.tests as object,
      employeesCount: { success: false, error: 'Employees count failed' },
    };
  }

  // Determine overall status
  const tests = results.tests as Record<string, { success: boolean }>;
  const allPassed = Object.values(tests).every(t => t.success);

  return NextResponse.json({
    success: allPassed,
    message: allPassed ? 'All tests passed' : 'Some tests failed - check details',
    ...results,
  }, { status: allPassed ? 200 : 500 });
}
