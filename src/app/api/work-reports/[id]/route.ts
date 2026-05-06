import { NextRequest, NextResponse } from 'next/server';
import { getWorkReportById, updateWorkReport, getEditPermissions, getTeamEmployeesForManager } from '@/lib/db/queries';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import type { ApiResponse, WorkReport, UpdateWorkReportInput } from '@/types';
import { getISTTodayDateString, convertUTCToISTDate } from '@/lib/date';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// NOTE: A GET handler used to live here to fetch a single work report by id,
// but no UI consumer ever called it (lists pull through GET /api/work-reports
// or the manager/employee report endpoints). It was removed to keep the
// surface small. Re-add only when there is a concrete caller that needs it.

// PUT: Update a work report
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const reportId = parseInt(id);

    if (isNaN(reportId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid report ID' },
        { status: 400 }
      );
    }

    const report = await getWorkReportById(reportId);

    if (!report) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    // Get edit permissions from settings
    const permissions = await getEditPermissions();
    
    // Check edit permissions based on role and settings
    const isOwnReport = report.employeeId === session.employeeId;
    
    let canEdit = false;
    
    if (session.role === 'superadmin') {
      canEdit = permissions.superadmin_can_edit_reports;
    } else if (session.role === 'admin') {
      canEdit = permissions.admin_can_edit_reports;
    } else if (session.role === 'employee') {
      // Employees can only edit their own reports if permission is enabled
      canEdit = isOwnReport && permissions.employee_can_edit_own_reports;
    } else if (session.role === 'manager' || session.role === 'teamhead') {
      // Managers can edit their own reports when employee_can_edit_own_reports is enabled
      if (isOwnReport && permissions.employee_can_edit_own_reports) {
        canEdit = true;
      } else if (permissions.manager_can_edit_team_reports) {
        // Managers can edit team members' reports if permission is enabled
        // Check if the employee is in the manager's team
        const teamEmployees = await getTeamEmployeesForManager(session.id);
        const isTeamMember = teamEmployees.some(emp => emp.employeeId === report.employeeId);
        canEdit = isTeamMember;
      }
    }

    if (!canEdit) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'You do not have permission to edit this report' },
        { status: 403 }
      );
    }

    // Check if the report was created today (edit only allowed on the same day as creation)
    const todayDate = getISTTodayDateString();
    const reportCreatedDate = convertUTCToISTDate(report.createdAt);
    
    if (reportCreatedDate !== todayDate) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Reports can only be edited on the same day they were created' },
        { status: 403 }
      );
    }

    // Parse the request body
    const body: UpdateWorkReportInput = await request.json();
    const { status, workReport, onDuty, halfday } = body;

    // Validate status if provided
    if (status && status !== 'working' && status !== 'leave') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid status. Must be "working" or "leave"' },
        { status: 400 }
      );
    }

    // If status is working, work report is required
    const newStatus = status || report.status;
    const newWorkReport = workReport !== undefined ? workReport : report.workReport;
    // onDuty and halfday are only applicable when status is working
    const newOnDuty = newStatus === 'working' ? (onDuty !== undefined ? onDuty : report.onDuty) : false;
    const newHalfday = newStatus === 'working' ? (halfday !== undefined ? halfday : report.halfday) : false;

    // Check if this is a manager editing a team member (isOwnReport already declared above)
    const isManagerEditingTeamMember = (session.role === 'manager' || session.role === 'teamhead') && !isOwnReport;

    // Work report is required when:
    // 1. Employee is editing their own report and status is working
    // 2. Anyone is editing and the report already has a work report (to prevent clearing it)
    // Managers editing team members can set status to working without work report
    if (newStatus === 'working') {
      if (isOwnReport && (!newWorkReport || newWorkReport.trim() === '')) {
        // Employee must provide work report for their own report
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Work report is required when status is "working"' },
          { status: 400 }
        );
      } else if (!isManagerEditingTeamMember && report.workReport && (!newWorkReport || newWorkReport.trim() === '')) {
        // If report already has work report, don't allow clearing it (unless manager is marking as working)
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Work report cannot be cleared' },
          { status: 400 }
        );
      }
      // Managers can set status to working without work report - employee will add it later
    }

    // Update the report
    const updatedReport = await updateWorkReport(reportId, newStatus, newWorkReport, newOnDuty, newHalfday);

    if (!updatedReport) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to update report' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<WorkReport>>({
      success: true,
      data: updatedReport,
      message: 'Work report updated successfully',
    });
  } catch (error) {
    logger.error('Update work report error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update work report' },
      { status: 500 }
    );
  }
}
