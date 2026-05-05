import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { 
  getEmployeesWithFilters,
  getWorkReportsByDateRange,
  getAllEntities,
  getAllBranches,
  getAllDepartments,
  getHolidays
} from '@/lib/db/queries';
import type { ApiResponse, Entity, Branch, Department, SafeEmployee, WorkReport } from '@/types';

interface EmployeeReportStatus {
  employeeId: string;
  name: string;
  department: string;
  entityId: number | null;
  branchId: number | null;
  dailyStatus: Record<string, 'submitted' | 'leave' | 'absent' | 'not_submitted' | 'sunday' | 'future'>;
  submittedCount: number;
  workingDaysCount: number;
}

interface MonthlyStatusResponse {
  employees: EmployeeReportStatus[];
  daysInMonth: number;
  year: number;
  month: number;
  entities: Entity[];
  branches: Branch[];
  departments: Department[];
  holidays: Array<{
    date: string;
    name: string | null;
  }>;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isSunday(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0;
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    // Allow superadmin, admin, manager/team head, and boardmember to access this endpoint
    const canViewReports = hasRole(session, ['superadmin', 'admin', 'manager', 'teamhead', 'boardmember']);
    
    if (!session || !canViewReports) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const monthParam = url.searchParams.get('month');
    const entityId = url.searchParams.get('entityId');
    const branchId = url.searchParams.get('branchId');
    const department = url.searchParams.get('department');

    // Default to current month if not provided
    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    const daysInMonth = getDaysInMonth(year, month);
    const startDate = formatDateString(year, month, 1);
    const endDate = formatDateString(year, month, daysInMonth);

    // Get employees with filters applied at database level (much faster)
    const employees: SafeEmployee[] = await getEmployeesWithFilters({
      status: 'active',
      entityId: entityId && entityId !== 'all' ? parseInt(entityId) : null,
      branchId: branchId && branchId !== 'all' ? parseInt(branchId) : null,
      department: department && department !== 'all' ? department : null,
    });

    // Get all work reports for the month
    const workReports: WorkReport[] = await getWorkReportsByDateRange(startDate, endDate);

    // Get holidays for the month
    const holidays = await getHolidays(undefined, startDate, endDate);
    const holidayDates = new Set(holidays.map(h => h.date));

    // Create a map of employee reports by date
    const reportMap = new Map<string, WorkReport>();
    for (const report of workReports) {
      const key = `${report.employeeId}-${report.date}`;
      reportMap.set(key, report);
    }

    // Get today's date for future date check
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build employee status data
    const employeeStatuses: EmployeeReportStatus[] = employees.map(employee => {
      const dailyStatus: Record<string, 'submitted' | 'leave' | 'absent' | 'not_submitted' | 'sunday' | 'future'> = {};
      let submittedCount = 0;
      let workingDaysCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateString(year, month, day);
        const dateObj = new Date(year, month - 1, day);
        dateObj.setHours(0, 0, 0, 0);
        
        // Check if it's a holiday (from holidays table) or Sunday
        if (holidayDates.has(dateStr) || isSunday(year, month, day)) {
          dailyStatus[dateStr] = 'sunday'; // Use 'sunday' status for both holidays and Sundays
        } else if (dateObj > today) {
          // Future date - mark as future, don't count
          dailyStatus[dateStr] = 'future';
        } else {
          workingDaysCount++;
          const key = `${employee.employeeId}-${dateStr}`;
          const report = reportMap.get(key);
          
          if (report) {
            if (report.status === 'leave' || report.status === 'absent') {
              // Treat absent as leave
              dailyStatus[dateStr] = 'leave';
              submittedCount++; // Leave counts as submitted
            } else {
              dailyStatus[dateStr] = 'submitted';
              submittedCount++;
            }
          } else {
            dailyStatus[dateStr] = 'not_submitted';
          }
        }
      }

      return {
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        entityId: employee.entityId,
        branchId: employee.branchId,
        dailyStatus,
        submittedCount,
        workingDaysCount: Math.max(0, workingDaysCount),
      };
    });

    // Sort by department, then by name
    employeeStatuses.sort((a, b) => {
      const deptCompare = a.department.localeCompare(b.department);
      if (deptCompare !== 0) return deptCompare;
      return a.name.localeCompare(b.name);
    });

    // Get filter options
    const entities = await getAllEntities();
    const branches = await getAllBranches();
    const departments = await getAllDepartments();

    // Add caching headers - but keep it short for real-time updates
    const response = NextResponse.json<ApiResponse<MonthlyStatusResponse>>({
      success: true,
      data: {
        employees: employeeStatuses,
        daysInMonth,
        year,
        month,
        entities,
        branches,
        departments,
        holidays: holidays.map(h => ({ date: h.date, name: h.name })),
      },
    });

    // Cache for 30 seconds - allows real-time updates while still benefiting from caching
    // stale-while-revalidate allows serving stale content while fetching fresh data
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=15');

    return response;
  } catch (error) {
    logger.error('Fetch monthly status error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch monthly status' },
      { status: 500 }
    );
  }
}
