import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/database';
import { getSession } from '@/lib/auth';

/**
 * POST /api/db/migrate
 * Runs pending database migrations
 * Only accessible by superadmin
 */
export async function POST() {
  try {
    // Check authentication - only superadmin can run migrations
    const session = await getSession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - superadmin access required' },
        { status: 403 }
      );
    }

    const migrations: { name: string; success: boolean; error?: string }[] = [];

    // Migration 1: Add on_duty column if it doesn't exist (in case it's also missing)
    try {
      const checkOnDuty = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'work_reports' AND column_name = 'on_duty'
        ) as exists
      `);

      if (!checkOnDuty.rows[0].exists) {
        await pool.query(`
          ALTER TABLE work_reports 
          ADD COLUMN on_duty BOOLEAN DEFAULT FALSE NOT NULL
        `);
        migrations.push({ name: 'add_on_duty_column', success: true });
      } else {
        migrations.push({ name: 'add_on_duty_column', success: true, error: 'Column already exists' });
      }
    } catch (error) {
      migrations.push({
        name: 'add_on_duty_column',
        success: false,
        error: 'Migration step failed'
      });
    }

    // Migration 2: Create holidays table if it doesn't exist
    try {
      const checkHolidays = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'holidays'
        ) as exists
      `);

      if (!checkHolidays.rows[0].exists) {
        await pool.query(`
          CREATE TABLE holidays (
            id SERIAL PRIMARY KEY,
            date TEXT UNIQUE NOT NULL,
            name TEXT,
            created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
          CREATE INDEX IF NOT EXISTS idx_holidays_created_by ON holidays(created_by);
        `);
        migrations.push({ name: 'create_holidays_table', success: true });
      } else {
        migrations.push({ name: 'create_holidays_table', success: true, error: 'Table already exists' });
      }
    } catch (error) {
      migrations.push({
        name: 'create_holidays_table',
        success: false,
        error: 'Migration step failed'
      });
    }

    const allSuccessful = migrations.every(m => m.success);

    return NextResponse.json({
      success: allSuccessful,
      message: allSuccessful ? 'All migrations completed successfully' : 'Some migrations failed',
      migrations,
    }, { status: allSuccessful ? 200 : 500 });

  } catch (error) {
    console.error('[API] Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST request to run migrations. Requires superadmin authentication.',
  });
}

