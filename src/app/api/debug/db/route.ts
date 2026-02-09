import { NextResponse } from 'next/server';
import { pool, getPoolHealth } from '@/lib/db/database';

export async function GET() {
  try {
    // 1. Check pool health
    const poolHealth = getPoolHealth();

    // 2. Try simple SELECT 1
    const start = performance.now();
    await pool.query('SELECT 1');
    const duration = performance.now() - start;

    // 3. List tables to check schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    // 4. Check specifically for employees table and count
    let employeesCount = 'Table not found';
    if (tables.includes('employees')) {
      try {
        const countRes = await pool.query('SELECT COUNT(*) FROM employees');
        employeesCount = countRes.rows[0].count;
      } catch (err) {
        employeesCount = `Error counting: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    // 5. Check environment
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_CONFIGURED: !!process.env.DATABASE_URL,
      // Mask password in DB URL
      DATABASE_URL_MASKED: process.env.DATABASE_URL 
        ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')
        : 'Not set'
    };

    return NextResponse.json({
      success: true,
      message: 'Database connection diagnostic',
      poolHealth,
      connectionDuration: `${duration.toFixed(2)}ms`,
      tables,
      employeesCount,
      env: envInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error),
      env: {
        DATABASE_URL_CONFIGURED: !!process.env.DATABASE_URL
      }
    }, { status: 500 });
  }
}
