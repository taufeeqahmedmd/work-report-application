import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTeamEmployeesForManager, getAllEmployees, getManagerDepartmentIds } from '@/lib/db/queries';
import { canMarkAttendance } from '@/lib/permissions';
import type { ApiResponse, SafeEmployee } from '@/types';

// GET: Get team employees for the current manager or employees from assigned departments for Operations users
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has mark_attendance permission
    if (!canMarkAttendance(session)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'You do not have permission to access this endpoint' },
        { status: 403 }
      );
    }

    let employeesList: SafeEmployee[];

    if (session.role === 'manager') {
      // Managers see employees from their assigned departments
      employeesList = await getTeamEmployeesForManager(session.id);
    } else if (session.department === 'Operations') {
      // Operations users: if they have departments assigned, show only those; otherwise show all employees
      const departmentIds = await getManagerDepartmentIds(session.id);
      if (departmentIds.length > 0) {
        // Has departments assigned - show only employees from those departments
        employeesList = await getTeamEmployeesForManager(session.id);
      } else {
        // No departments assigned - show all active employees
        const allEmployees = await getAllEmployees();
        employeesList = allEmployees.filter(emp => emp.status === 'active' && emp.employeeId !== session.employeeId);
      }
    } else {
      // Other non-manager users with mark_attendance permission can see all active employees
      const allEmployees = await getAllEmployees();
      employeesList = allEmployees.filter(emp => emp.status === 'active' && emp.employeeId !== session.employeeId);
    }

    return NextResponse.json<ApiResponse<SafeEmployee[]>>({
      success: true,
      data: employeesList,
    });
  } catch (error) {
    console.error('Get team employees error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}
