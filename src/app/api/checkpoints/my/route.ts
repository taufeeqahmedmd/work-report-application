import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ensureCheckpointTables } from '@/lib/team-checkpoints';
import { pool } from '@/lib/db/database';
import type { ApiResponse } from '@/types';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureCheckpointTables();
    const result = await pool.query(
      `
      SELECT
        ec.id,
        CASE
          WHEN tc.recurrence_type = 'daily' THEN
            (ec.completed_at IS NOT NULL AND (ec.completed_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
          WHEN tc.recurrence_type = 'weekly' THEN
            (ec.completed_at IS NOT NULL AND DATE_TRUNC('week', ec.completed_at AT TIME ZONE 'Asia/Kolkata') = DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Kolkata'))
          WHEN tc.recurrence_type = 'monthly' THEN
            (ec.completed_at IS NOT NULL AND DATE_TRUNC('month', ec.completed_at AT TIME ZONE 'Asia/Kolkata') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata'))
          ELSE
            ec.is_completed
        END AS "isCompleted",
        ec.assigned_at AS "assignedAt",
        ec.completed_at AS "completedAt",
        tc.id AS "checkpointId",
        tc.title,
        tc.description,
        tc.department,
        tc.is_active AS "isActive",
        tc.recurrence_type AS "recurrenceType",
        tc.starts_at::text AS "startsAt",
        tc.ends_at::text AS "endsAt",
        tc.due_at::text AS "dueAt",
        tc.starts_on::text AS "startsOn",
        tc.ends_on::text AS "endsOn",
        tc.due_date::text AS "dueDate"
      FROM employee_checkpoints ec
      JOIN team_checkpoints tc ON tc.id = ec.checkpoint_id
      WHERE ec.employee_id = $1
        AND tc.is_active = TRUE
      ORDER BY ec.assigned_at DESC
      `,
      [session.employeeId]
    );

    return NextResponse.json<ApiResponse<{ checkpoints: unknown[] }>>({ success: true, data: { checkpoints: result.rows } });
  } catch (error) {
    console.error('My checkpoints GET error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch checkpoints' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { employeeCheckpointId?: number; isCompleted?: boolean };
    if (!body.employeeCheckpointId || typeof body.isCompleted !== 'boolean') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    await ensureCheckpointTables();
    const result = await pool.query(
      `
      UPDATE employee_checkpoints
      SET is_completed = $1,
          completed_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = $2
        AND employee_id = $3
      RETURNING id
      `,
      [body.isCompleted, body.employeeCheckpointId, session.employeeId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Checklist item not found' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'Checklist updated' });
  } catch (error) {
    console.error('My checkpoints PATCH error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to update checklist' }, { status: 500 });
  }
}
