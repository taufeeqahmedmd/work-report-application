import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getManagerDepartments, getTeamEmployeesForManager } from '@/lib/db/queries';
import { ensureCheckpointTables } from '@/lib/team-checkpoints';
import { pool } from '@/lib/db/database';
import type { ApiResponse } from '@/types';

function canManageTeam(role: string): boolean {
  return role === 'manager' || role === 'teamhead';
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !canManageTeam(session.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureCheckpointTables();
    const departments = await getManagerDepartments(session.id);
    const names = departments.map(d => d.name);

    if (names.length === 0) {
      return NextResponse.json<ApiResponse<{ checkpoints: unknown[] }>>({ success: true, data: { checkpoints: [] } });
    }

    const result = await pool.query(
      `
      SELECT
        tc.id,
        tc.title,
        tc.description,
        tc.department,
        tc.is_active AS "isActive",
        tc.recurrence_type AS "recurrenceType",
        tc.starts_on::text AS "startsOn",
        tc.ends_on::text AS "endsOn",
        tc.due_date::text AS "dueDate",
        tc.starts_at::text AS "startsAt",
        tc.ends_at::text AS "endsAt",
        tc.due_at::text AS "dueAt",
        tc.created_at AS "createdAt",
        COUNT(ec.id)::int AS "assigneeCount",
        COUNT(CASE WHEN ec.is_completed THEN 1 END)::int AS "completedCount",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'assignmentId', ec.id,
              'employeeId', ec.employee_id,
              'name', e.name,
              'isCompleted', ec.is_completed
            )
          ) FILTER (WHERE ec.id IS NOT NULL),
          '[]'::json
        ) AS assignments
      FROM team_checkpoints tc
      LEFT JOIN employee_checkpoints ec ON ec.checkpoint_id = tc.id
      LEFT JOIN employees e ON e.employee_id = ec.employee_id
      WHERE tc.department = ANY($1::text[])
      GROUP BY tc.id
      ORDER BY tc.created_at DESC
      `,
      [names]
    );

    return NextResponse.json<ApiResponse<{ checkpoints: unknown[] }>>({
      success: true,
      data: { checkpoints: result.rows },
    });
  } catch (error) {
    console.error('Get checkpoints error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch checkpoints' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManageTeam(session.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureCheckpointTables();

    const body = await request.json() as {
      title?: string;
      description?: string;
      department?: string;
      assignmentMode?: 'team' | 'individual';
      employeeIds?: string[];
      recurrenceType?: 'one_time' | 'daily' | 'weekly' | 'monthly';
      startsOn?: string;
      endsOn?: string;
      dueDate?: string;
      startsAt?: string;
      endsAt?: string;
      dueAt?: string;
    };

    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const department = body.department?.trim();
    const assignmentMode = body.assignmentMode === 'individual' ? 'individual' : 'team';
    const requestedEmployeeIds = Array.isArray(body.employeeIds) ? body.employeeIds : [];
    const recurrenceType = body.recurrenceType && ['one_time', 'daily', 'weekly', 'monthly'].includes(body.recurrenceType)
      ? body.recurrenceType
      : 'one_time';
    const startsOn = body.startsOn?.trim() || null;
    const endsOn = body.endsOn?.trim() || null;
    const dueDate = body.dueDate?.trim() || null;
    const startsAt = body.startsAt?.trim() || null;
    const endsAt = body.endsAt?.trim() || null;
    const dueAt = body.dueAt?.trim() || null;

    if (!title || !department) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Title and department are required' }, { status: 400 });
    }

    const managerDepartments = await getManagerDepartments(session.id);
    const allowedDepartmentNames = new Set(managerDepartments.map(d => d.name));
    if (!allowedDepartmentNames.has(department)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Department is outside your scope' }, { status: 403 });
    }

    const teamUsers = await getTeamEmployeesForManager(session.id);
    const usersInDepartment = teamUsers.filter(u => u.department === department && u.status === 'active');

    const assignees = assignmentMode === 'individual'
      ? usersInDepartment.filter(user => requestedEmployeeIds.includes(user.employeeId))
      : usersInDepartment;

    if (assignees.length === 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            assignmentMode === 'individual'
              ? 'Select at least one valid assignee from your team'
              : 'Selected department has no active team members to assign',
        },
        { status: 400 }
      );
    }

    const scheduleStart = startsAt ?? startsOn;
    const scheduleEnd = endsAt ?? endsOn;
    if (scheduleStart && scheduleEnd && scheduleStart > scheduleEnd) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Start cannot be after end' }, { status: 400 });
    }

    const checkpointResult = await pool.query(
      `
      INSERT INTO team_checkpoints (
        title, description, department, recurrence_type,
        starts_on, ends_on, due_date,
        starts_at, ends_at, due_at,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
      `,
      [
        title,
        description,
        department,
        recurrenceType,
        startsOn,
        endsOn,
        dueDate,
        startsAt,
        endsAt,
        dueAt,
        session.id,
      ]
    );

    const checkpointId = checkpointResult.rows[0]?.id as number;
    for (const assignee of assignees) {
      await pool.query(
        `
        INSERT INTO employee_checkpoints (checkpoint_id, employee_id, assigned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (checkpoint_id, employee_id) DO NOTHING
        `,
        [checkpointId, assignee.employeeId, session.id]
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Checkpoint created and assigned to ${assignees.length} team member(s)`,
    });
  } catch (error) {
    console.error('Create checkpoint error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to create checkpoint' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !canManageTeam(session.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureCheckpointTables();

    const body = await request.json() as {
      action?: 'assign' | 'remove' | 'update' | 'toggle_active';
      checkpointId?: number;
      employeeIds?: string[];
      title?: string;
      description?: string;
      recurrenceType?: 'one_time' | 'daily' | 'weekly' | 'monthly';
      startsOn?: string | null;
      endsOn?: string | null;
      dueDate?: string | null;
      startsAt?: string | null;
      endsAt?: string | null;
      dueAt?: string | null;
      isActive?: boolean;
    };

    const action = body.action;
    const checkpointId = Number(body.checkpointId);
    const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds : [];

    if (!action || Number.isNaN(checkpointId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const checkpointResult = await pool.query(
      `SELECT id, department FROM team_checkpoints WHERE id = $1`,
      [checkpointId]
    );
    if (checkpointResult.rowCount === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Checkpoint not found' }, { status: 404 });
    }
    const department = checkpointResult.rows[0].department as string;

    const managerDepartments = await getManagerDepartments(session.id);
    const allowedDepartmentNames = new Set(managerDepartments.map(d => d.name));
    if (!allowedDepartmentNames.has(department)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Checkpoint is outside your scope' }, { status: 403 });
    }

    const teamUsers = await getTeamEmployeesForManager(session.id);
    const validEmployeeIds = new Set(
      teamUsers
        .filter(user => user.department === department)
        .map(user => user.employeeId)
    );
    const scopedIds = employeeIds.filter(id => validEmployeeIds.has(id));

    if (action === 'assign') {
      if (scopedIds.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'No valid team users selected' }, { status: 400 });
      }
      for (const employeeId of scopedIds) {
        await pool.query(
          `
          INSERT INTO employee_checkpoints (checkpoint_id, employee_id, assigned_by)
          VALUES ($1, $2, $3)
          ON CONFLICT (checkpoint_id, employee_id) DO NOTHING
          `,
          [checkpointId, employeeId, session.id]
        );
      }
      return NextResponse.json<ApiResponse>({ success: true, message: `Assigned to ${scopedIds.length} user(s)` });
    }

    if (action === 'remove') {
      if (scopedIds.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'No valid team users selected' }, { status: 400 });
      }
      await pool.query(
        `
        DELETE FROM employee_checkpoints
        WHERE checkpoint_id = $1
          AND employee_id = ANY($2::text[])
        `,
        [checkpointId, scopedIds]
      );
      return NextResponse.json<ApiResponse>({ success: true, message: `Removed from ${scopedIds.length} user(s)` });
    }

    if (action === 'toggle_active') {
      if (typeof body.isActive !== 'boolean') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid active flag' }, { status: 400 });
      }
      await pool.query(`UPDATE team_checkpoints SET is_active = $1 WHERE id = $2`, [body.isActive, checkpointId]);
      return NextResponse.json<ApiResponse>({ success: true, message: body.isActive ? 'Activated' : 'Deactivated' });
    }

    if (action === 'update') {
      const title = body.title?.trim();
      if (!title) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Title is required' }, { status: 400 });
      }
      const description = body.description?.trim() || null;
      const recurrenceType =
        body.recurrenceType && ['one_time', 'daily', 'weekly', 'monthly'].includes(body.recurrenceType)
          ? body.recurrenceType
          : 'one_time';

      const startsOn = body.startsOn ? String(body.startsOn).trim() : null;
      const endsOn = body.endsOn ? String(body.endsOn).trim() : null;
      const dueDate = body.dueDate ? String(body.dueDate).trim() : null;
      const startsAt = body.startsAt ? String(body.startsAt).trim() : null;
      const endsAt = body.endsAt ? String(body.endsAt).trim() : null;
      const dueAt = body.dueAt ? String(body.dueAt).trim() : null;

      const scheduleStart = startsAt ?? startsOn;
      const scheduleEnd = endsAt ?? endsOn;
      if (scheduleStart && scheduleEnd && scheduleStart > scheduleEnd) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Start cannot be after end' }, { status: 400 });
      }

      await pool.query(
        `
        UPDATE team_checkpoints
        SET title = $1,
            description = $2,
            recurrence_type = $3,
            starts_on = $4,
            ends_on = $5,
            due_date = $6,
            starts_at = $7,
            ends_at = $8,
            due_at = $9
        WHERE id = $10
        `,
        [title, description, recurrenceType, startsOn, endsOn, dueDate, startsAt, endsAt, dueAt, checkpointId]
      );
      return NextResponse.json<ApiResponse>({ success: true, message: 'Checklist updated' });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Update checkpoint assignments error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to update checklist assignments' }, { status: 500 });
  }
}
