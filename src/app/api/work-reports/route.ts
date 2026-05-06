import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  getWorkReports,
  getWorkReportsByEmployee,
  getWorkReportsByDateRange,
  getWorkReportsByDateRangeAndDepartments,
  getWorkReportsByEmployeeAndDateRange,
  getWorkReportCount,
  searchWorkReports,
  getWorkReportsByDepartment,
  getUniqueWorkReportDepartments,
  getManagerDepartmentIds,
  searchWorkReportsForManager,
  getWorkReportsByDepartmentForManager,
  getUniqueWorkReportDepartmentsForManager,
  getAllDepartments
} from '@/lib/db/queries';
import { getSession } from '@/lib/auth';
import type { ApiResponse, WorkReport } from '@/types';

// GET: Fetch work reports with optional filters
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const search = url.searchParams.get('search');
    const department = url.searchParams.get('department');
    const getDepartments = url.searchParams.get('getDepartments');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Managers, admins, and superadmins can view all reports
    const canViewAll = session.role === 'admin' || session.role === 'superadmin' || session.role === 'manager' || session.role === 'teamhead';
    const isManager = session.role === 'manager' || session.role === 'teamhead';

    // Return unique departments list if requested
    if (getDepartments === 'true' && canViewAll) {
      // For managers, only return their assigned departments
      const departments = isManager
        ? await getUniqueWorkReportDepartmentsForManager(session.id)
        : await getUniqueWorkReportDepartments();
      return NextResponse.json<ApiResponse<{ departments: string[] }>>({
        success: true,
        data: { departments },
      });
    }

    if (!canViewAll && employeeId && employeeId !== session.employeeId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'You can only view your own reports' },
        { status: 403 }
      );
    }

    let reports: WorkReport[];

    // For managers, filter by their assigned departments
    if (isManager) {
      const managerDeptIds = await getManagerDepartmentIds(session.id);

      if (managerDeptIds.length === 0) {
        // Manager has no departments assigned, return empty
        return NextResponse.json<ApiResponse<{ reports: WorkReport[]; total: number }>>({
          success: true,
          data: {
            reports: [],
            total: 0,
          },
        });
      }

      // Get department names for the manager
      const allDepts = await getAllDepartments();
      const managerDeptNames = allDepts
        .filter(d => managerDeptIds.includes(d.id))
        .map(d => d.name);

      // Search functionality for managers (filtered by their departments)
      if (search) {
        reports = await searchWorkReportsForManager(search, session.id, department || undefined);
        // Apply date filter if provided
        if (startDate && endDate) {
          reports = reports.filter(r => r.date >= startDate && r.date <= endDate);
        }
      } else if (department && department !== 'all') {
        // Filter by department only (if manager has access)
        if (managerDeptNames.includes(department)) {
          reports = await getWorkReportsByDepartmentForManager(department, session.id);
          // Apply date filter if provided
          if (startDate && endDate) {
            reports = reports.filter(r => r.date >= startDate && r.date <= endDate);
          }
        } else {
          reports = [];
        }
      } else if (employeeId) {
        // Filter by employee (but only if employee is in manager's departments)
        if (startDate && endDate) {
          // Use optimized query with date range
          reports = await getWorkReportsByEmployeeAndDateRange(employeeId, startDate, endDate);
        } else {
          const empReports = await getWorkReportsByEmployee(employeeId);
          reports = empReports.filter(r => managerDeptNames.includes(r.department));
        }
        // Still need to filter by department in JS for employee reports
        reports = reports.filter(r => managerDeptNames.includes(r.department));
      } else if (startDate && endDate) {
        // Use optimized query - filter by date range AND departments at database level
        reports = await getWorkReportsByDateRangeAndDepartments(startDate, endDate, managerDeptNames);
      } else {
        // Get all reports from manager's departments (when "all" is selected or no filter)
        const allReports = await getWorkReports(limit, offset);
        reports = allReports.filter(r => managerDeptNames.includes(r.department));
      }
    } else {
      // Search functionality for admins/superadmins (no filtering)
      if (canViewAll && search) {
        reports = await searchWorkReports(search, department || undefined);
      } else if (canViewAll && department && department !== 'all') {
        // Filter by department only
        reports = await getWorkReportsByDepartment(department);
      } else if (employeeId) {
        // Filter by employee
        if (startDate && endDate) {
          // Use optimized query with date range
          reports = await getWorkReportsByEmployeeAndDateRange(employeeId, startDate, endDate);
        } else {
          reports = await getWorkReportsByEmployee(employeeId);
        }
      } else if (startDate && endDate) {
        // Filter by date range - only managers/admins can view all reports by date
        if (!canViewAll) {
          // For regular employees, filter by their own ID within the date range
          reports = await getWorkReportsByEmployeeAndDateRange(session.employeeId, startDate, endDate);
        } else {
          reports = await getWorkReportsByDateRange(startDate, endDate);
        }
      } else {
        // Get all reports - only managers/admins can view all, others get their own
        if (!canViewAll) {
          reports = await getWorkReportsByEmployee(session.employeeId);
        } else {
          reports = await getWorkReports(limit, offset);
        }
      }
    }

    // For managers/teamheads the global getWorkReportCount() leaks counts from
    // departments they don't manage. Use the filtered result length so the UI
    // total matches what they're actually allowed to see. Admins/superadmins
    // still get the global total since they can view everything.
    const isAdminLevel = session.role === 'admin' || session.role === 'superadmin';
    const totalCount = isAdminLevel ? await getWorkReportCount() : reports.length;

    return NextResponse.json<ApiResponse<{ reports: WorkReport[]; total: number }>>({
      success: true,
      data: {
        reports,
        total: totalCount,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConnectionError =
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('Connection terminated') ||
      errorMessage.includes('connection timeout') ||
      errorMessage.includes('ENOTFOUND');

    // Log full error server-side only
    logger.error('Fetch work reports error:', errorMessage);
    console.error('[API] Work reports fetch error:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: isConnectionError
          ? 'Database connection error. Please try again in a few moments.'
          : 'Failed to fetch work reports',
      },
      { status: 500 }
    );
  }
}

// NOTE: The previous synchronous POST /api/work-reports handler was removed.
// Work-report submission goes through the async pipeline at
// POST /api/work-reports/submit which handles validation, deduplication, and
// onDuty/halfday flags consistently. Keep this file as a GET-only listing
// endpoint to avoid drift between two parallel submission paths.
