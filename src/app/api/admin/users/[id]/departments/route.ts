import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  getEmployeeById,
  getManagerDepartments,
  setManagerDepartments 
} from '@/lib/db/queries';
import type { ApiResponse, Department } from '@/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Get departments for a manager or Operations user
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const employee = await getEmployeeById(userId);
    if (!employee) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Allow managers and Operations department users
    if ((employee.role !== 'manager' && employee.role !== 'teamhead') && employee.department !== 'Operations') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User is not a manager or Operations department user' },
        { status: 400 }
      );
    }

    const departments = await getManagerDepartments(userId);

    return NextResponse.json<ApiResponse<Department[]>>({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error('Get user departments error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch user departments' },
      { status: 500 }
    );
  }
}

// PUT: Set departments for a manager or Operations user (replaces existing)
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();
    
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only admins can set user departments' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const employee = await getEmployeeById(userId);
    if (!employee) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Allow managers and Operations department users
    if ((employee.role !== 'manager' && employee.role !== 'teamhead') && employee.department !== 'Operations') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User is not a manager or Operations department user' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { departmentIds } = body;

    if (!Array.isArray(departmentIds)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'departmentIds must be an array' },
        { status: 400 }
      );
    }

    await setManagerDepartments(userId, departmentIds);

    const departments = await getManagerDepartments(userId);

    return NextResponse.json<ApiResponse<Department[]>>({
      success: true,
      data: departments,
      message: 'User departments updated successfully',
    });
  } catch (error) {
    console.error('Set user departments error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to set user departments' },
      { status: 500 }
    );
  }
}
