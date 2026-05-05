import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmployeeById, updateEmployee, getTeamEmployeesForManager } from '@/lib/db/queries';
import type { ApiResponse } from '@/types';

function canManageTeam(role: string): boolean {
  return role === 'manager' || role === 'teamhead';
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !canManageTeam(session.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const userId = Number(id);
    if (Number.isNaN(userId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid user id' }, { status: 400 });
    }

    const body = await request.json() as { status?: 'active' | 'inactive' };
    if (!body.status || !['active', 'inactive'].includes(body.status)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const target = await getEmployeeById(userId);
    if (!target) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'User not found' }, { status: 404 });
    }

    const teamUsers = await getTeamEmployeesForManager(session.id);
    const inScope = teamUsers.some(u => u.id === userId);
    if (!inScope) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'User is outside your team scope' }, { status: 403 });
    }

    await updateEmployee(userId, { status: body.status });
    return NextResponse.json<ApiResponse>({ success: true, message: `User ${body.status === 'active' ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Update team user status error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to update user status' }, { status: 500 });
  }
}
