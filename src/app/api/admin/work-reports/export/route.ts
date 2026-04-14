import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { getWorkReportsForSuperAdminExport, getBranchById } from '@/lib/db/queries';
import { logger } from '@/lib/logger';
import type { ApiResponse, WorkReportExportRow } from '@/types';

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: WorkReportExportRow[]): string {
  const header = [
    'ID',
    'Date',
    'Employee ID',
    'Name',
    'Email',
    'Department',
    'Entity',
    'Branch',
    'Status',
    'Work Report',
    'On Duty',
    'Half Day',
    'Created At',
  ];

  const lines = [
    header.map(escapeCsvCell).join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.date,
        r.employeeId,
        r.name,
        r.email,
        r.department,
        r.entityName ?? '',
        r.branchName ?? '',
        r.status,
        r.workReport,
        r.onDuty ? 'Yes' : 'No',
        r.halfday ? 'Yes' : 'No',
        r.createdAt,
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];

  return `\ufeff${lines.join('\r\n')}`;
}

/**
 * GET: Super-admin CSV export of work reports (optional filters).
 * Query: allDates=true OR (startDate + endDate), optional entityId, branchId, department, status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !isSuperAdmin(session)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only super administrators can export work reports' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const allDates = url.searchParams.get('allDates') === 'true';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const entityIdRaw = url.searchParams.get('entityId');
    const branchIdRaw = url.searchParams.get('branchId');
    const department = url.searchParams.get('department');
    const statusRaw = url.searchParams.get('status');

    if (!allDates && (!startDate || !endDate)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Provide startDate and endDate (YYYY-MM-DD), or set allDates=true for a full export (capped at 100,000 rows).',
        },
        { status: 400 }
      );
    }

    if (!allDates && startDate && endDate && endDate < startDate) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'endDate must be on or after startDate' },
        { status: 400 }
      );
    }

    let entityId: number | undefined;
    if (entityIdRaw && entityIdRaw !== 'all') {
      const n = parseInt(entityIdRaw, 10);
      if (Number.isNaN(n)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid entityId' }, { status: 400 });
      }
      entityId = n;
    }

    let branchId: number | undefined;
    if (branchIdRaw && branchIdRaw !== 'all') {
      const n = parseInt(branchIdRaw, 10);
      if (Number.isNaN(n)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid branchId' }, { status: 400 });
      }
      branchId = n;
    }

    if (entityId !== undefined && branchId !== undefined) {
      const branch = await getBranchById(branchId);
      if (!branch || branch.entityId !== entityId) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Selected branch does not belong to the selected entity' },
          { status: 400 }
        );
      }
    }

    let status: 'working' | 'leave' | 'absent' | undefined;
    if (statusRaw && statusRaw !== 'all') {
      if (statusRaw !== 'working' && statusRaw !== 'leave' && statusRaw !== 'absent') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid status' }, { status: 400 });
      }
      status = statusRaw;
    }

    const rows = await getWorkReportsForSuperAdminExport({
      allDates,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      entityId,
      branchId,
      department: department && department !== 'all' ? department : undefined,
      status,
    });

    const csv = buildCsv(rows);
    const dayStamp = new Date().toISOString().slice(0, 10);
    const filename = `work-reports-export-${dayStamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    logger.error('Work reports export error:', error);

    if (message.includes('Export exceeds')) {
      return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 413 });
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to export work reports' },
      { status: 500 }
    );
  }
}
