import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db/database';
import { getISTTodayDateString, shiftISTDate } from '@/lib/date';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/types';

interface DailyStats {
  date: string;
  working: number;
  leave: number;
  total: number;
}

interface DepartmentStats {
  department: string;
  working: number;
  leave: number;
  total: number;
}

interface AnalyticsData {
  summary: {
    totalReports: number;
    workingDays: number;
    leaveDays: number;
    uniqueEmployees: number;
  };
  dailyStats: DailyStats[];
  departmentStats: DepartmentStats[];
  recentReports: Array<{
    employeeId: string;
    name: string;
    date: string;
    status: string;
    department: string;
  }>;
}

// GET: Get analytics data
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Org-wide analytics - restrict to admin/superadmin/boardmember roles.
    if (
      session.role !== 'admin' &&
      session.role !== 'superadmin' &&
      session.role !== 'boardmember'
    ) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    // Use IST helpers so the start cutoff is correct regardless of host TZ.
    const startDateStr = shiftISTDate(getISTTodayDateString(), -days);

    // Get summary stats
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(*) as "totalReports",
        SUM(CASE WHEN status = 'working' THEN 1 ELSE 0 END) as "workingDays",
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as "leaveDays",
        COUNT(DISTINCT employee_id) as "uniqueEmployees"
      FROM work_reports
      WHERE date >= $1
    `, [startDateStr]);
    
    const summary = summaryResult.rows[0] || {
      totalReports: 0,
      workingDays: 0,
      leaveDays: 0,
      uniqueEmployees: 0,
    };

    // Get daily stats
    const dailyResult = await pool.query(`
      SELECT 
        date,
        SUM(CASE WHEN status = 'working' THEN 1 ELSE 0 END) as working,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave,
        COUNT(*) as total
      FROM work_reports
      WHERE date >= $1
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `, [startDateStr]);
    const dailyStats = dailyResult.rows as DailyStats[];

    // Get department stats
    const departmentResult = await pool.query(`
      SELECT 
        department,
        SUM(CASE WHEN status = 'working' THEN 1 ELSE 0 END) as working,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave,
        COUNT(*) as total
      FROM work_reports
      WHERE date >= $1
      GROUP BY department
      ORDER BY total DESC
    `, [startDateStr]);
    const departmentStats = departmentResult.rows as DepartmentStats[];

    // Get recent reports
    const recentResult = await pool.query(`
      SELECT employee_id as "employeeId", name, date, status, department
      FROM work_reports
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const recentReports = recentResult.rows as Array<{
      employeeId: string;
      name: string;
      date: string;
      status: string;
      department: string;
    }>;

    const analyticsData: AnalyticsData = {
      summary: {
        totalReports: parseInt(summary.totalReports) || 0,
        workingDays: parseInt(summary.workingDays) || 0,
        leaveDays: parseInt(summary.leaveDays) || 0,
        uniqueEmployees: parseInt(summary.uniqueEmployees) || 0,
      },
      dailyStats: dailyStats.reverse(), // Reverse to show oldest first for charts
      departmentStats,
      recentReports,
    };

    // Add caching headers - analytics data changes infrequently
    const response = NextResponse.json<ApiResponse<AnalyticsData>>({
      success: true,
      data: analyticsData,
    });

    // Cache for 2 minutes - analytics don't need real-time but should be reasonably fresh
    // stale-while-revalidate allows serving stale content while fetching fresh data
    response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');

    return response;
  } catch (error) {
    logger.error('Analytics error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
