import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  getEmployeeByEmployeeId,
  getWorkReportByEmployeeAndDate,
  createWorkReport,
  updateWorkReport
} from '@/lib/db/queries';
import { canMarkAttendance } from '@/lib/permissions';
import type { ApiResponse, WorkReport } from '@/types';

// POST: Mark an employee as present (working)
export async function POST(request: NextRequest) {
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
        { success: false, error: 'You do not have permission to mark employees as present' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { employeeId, date } = body;

    // Validate required fields
    if (!employeeId || !date) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: employeeId and date are required' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Get the employee
    const employee = await getEmployeeByEmployeeId(employeeId);
    if (!employee) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Users with mark_attendance permission can mark attendance regardless of role/department.

    // Check if a work report already exists for this employee and date
    const existingReport = await getWorkReportByEmployeeAndDate(employeeId, date);
    
    if (existingReport) {
      // Preserve any work report text and onDuty/halfday flags the employee
      // (or another manager) may have already submitted. Only flip the status.
      const updatedReport = await updateWorkReport(
        existingReport.id,
        'working',
        existingReport.workReport ?? null,
        existingReport.onDuty ?? false,
        existingReport.halfday ?? false
      );

      return NextResponse.json<ApiResponse<WorkReport>>({
        success: true,
        data: updatedReport!,
        message: 'Employee marked as present (working) successfully',
      });
    } else {
      // Create new work report with working status
      const newReport = await createWorkReport({
        employeeId: employee.employeeId,
        date,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        status: 'working',
        workReport: null,
        onDuty: false,
        halfday: false,
      });

      return NextResponse.json<ApiResponse<WorkReport>>({
        success: true,
        data: newReport,
        message: 'Employee marked as present successfully',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Mark present error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to mark employee as present' },
      { status: 500 }
    );
  }
}

