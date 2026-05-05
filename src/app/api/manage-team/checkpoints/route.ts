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
        tc.created_at AS "createdAt",
        COUNT(ec.id)::int AS "assigneeCount",
        COUNT(CASE WHEN ec.is_completed THEN 1 END)::int AS "completedCount"
      FROM team_checkpoints tc
      LEFT JOIN employee_checkpoints ec ON ec.checkpoint_id = tc.id
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
    };

    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const department = body.department?.trim();
    const assignmentMode = body.assignmentMode === 'individual' ? 'individual' : 'team';
    const requestedEmployeeIds = Array.isArray(body.employeeIds) ? body.employeeIds : [];

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

    const checkpointResult = await pool.query(
      `
      INSERT INTO team_checkpoints (title, description, department, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [title, description, department, session.id]
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
