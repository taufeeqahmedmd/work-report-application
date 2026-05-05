import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import {
  createEmployee,
  getEmployeeByEmail,
  getEmployeeByEmployeeId,
  getManagerDepartments,
} from '@/lib/db/queries';
import type { ApiResponse, SafeEmployee, PageAccess, Employee } from '@/types';

function toSafeEmployee(emp: Employee): SafeEmployee {
  let parsedPageAccess: PageAccess | null = null;
  if (emp.pageAccess) {
    try {
      parsedPageAccess = JSON.parse(emp.pageAccess) as PageAccess;
    } catch {
      parsedPageAccess = null;
    }
  }

  return {
    id: emp.id,
    employeeId: emp.employeeId,
    name: emp.name,
    email: emp.email,
    department: emp.department,
    entityId: emp.entityId,
    branchId: emp.branchId,
    role: emp.role,
    status: emp.status,
    pageAccess: parsedPageAccess,
    createdBy: emp.createdBy,
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
  };
}

// POST: Manager creates a team member (employee role only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'manager' && session.role !== 'teamhead') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only managers or team heads can create team users' },
        { status: 403 }
      );
    }

    const body = await request.json() as {
      employeeId?: string;
      name?: string;
      email?: string;
      password?: string;
      department?: string;
    };

    const employeeId = body.employeeId?.trim();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const department = body.department?.trim();

    if (!employeeId || !name || !email || !password || !department) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Manager can only add users in their assigned departments
    const managerDepartments = await getManagerDepartments(session.id);
    const allowedDepartmentNames = new Set(managerDepartments.map(d => d.name));

    if (!allowedDepartmentNames.has(department)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'You can only add users in your assigned team departments' },
        { status: 403 }
      );
    }

    // Unique checks
    const existingByEmployeeId = await getEmployeeByEmployeeId(employeeId);
    if (existingByEmployeeId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Employee ID already exists' },
        { status: 409 }
      );
    }

    const existingByEmail = await getEmployeeByEmail(email);
    if (existingByEmail) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Role is restricted to employee. Entity/branch follow manager scope.
    const created = await createEmployee({
      employeeId,
      name,
      email,
      department,
      password: hashedPassword,
      entityId: session.entityId ?? null,
      branchId: session.branchId ?? null,
      role: 'employee',
      createdBy: session.id,
    });

    return NextResponse.json<ApiResponse<SafeEmployee>>(
      { success: true, data: toSafeEmployee(created), message: 'Team user created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create team user error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to create team user' },
      { status: 500 }
    );
  }
}
