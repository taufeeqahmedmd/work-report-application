'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  FileText, 
  Briefcase, 
  Coffee, 
  TrendingUp, 
  Calendar,
  Pencil, 
  X, 
  Check,
  User,
  Building2,
  Plus,
  ChevronDown,
  AlertCircle,
  Shield,
  Clock,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Mail,
  RotateCcw,
  Bell,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { WorkReport, SessionUser, WorkStatus, EditPermissions, Holiday } from '@/types';
import { getISTTodayDateString, getISTYear, getShortDayIST, getShortDateIST, formatDateForDisplay, getDayOfMonthIST, convertUTCToISTDate } from '@/lib/date';
import { logger } from '@/lib/logger';
import { WorkReportCalendar } from '@/components/work-report-calendar';
import { ThemeToggle } from '@/components/theme-toggle';

export default function EmployeeDashboardPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [reports, setReports] = useState<WorkReport[]>([]);
  /** Full-window fetch for calendar coloring — independent of list date filter */
  const [calendarReports, setCalendarReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [editPermissions, setEditPermissions] = useState<EditPermissions | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [checkpoints, setCheckpoints] = useState<Array<{
    id: number;
    checkpointId: number;
    title: string;
    description: string | null;
    department: string;
    isActive?: boolean;
    recurrenceType: 'one_time' | 'daily' | 'weekly' | 'monthly';
    startsAt?: string | null;
    endsAt?: string | null;
    dueAt?: string | null;
    startsOn?: string | null;
    endsOn?: string | null;
    dueDate?: string | null;
    isCompleted: boolean;
  }>>([]);

  // Edit state
  const [editingReport, setEditingReport] = useState<WorkReport | null>(null);
  const [editStatus, setEditStatus] = useState<WorkStatus>('working');
  const [editWorkReport, setEditWorkReport] = useState('');
  const [saving, setSaving] = useState(false);

  // Expanded report state
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  // Default the inline list to "this month so far" using IST so users in any
  // timezone see the same month boundaries as the rest of the app.
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const today = getISTTodayDateString();
    return {
      start: `${today.slice(0, 7)}-01`,
      end: today,
    };
  });

  // Check if user can edit their own reports
  const canEditOwnReports = editPermissions?.employee_can_edit_own_reports || false;

  // Check if a report can be edited (only on the same day it was created)
  const canEditReport = useCallback((report: WorkReport) => {
    if (!canEditOwnReports) return false;
    const createdDate = convertUTCToISTDate(report.createdAt);
    const todayDate = getISTTodayDateString();
    return createdDate === todayDate;
  }, [canEditOwnReports]);

  // Fetch session and permissions on mount
  useEffect(() => {
    const fetchSessionAndPermissions = async () => {
      try {
        const [sessionRes, permissionsRes] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/settings/permissions'),
        ]);
        
        const [sessionData, permissionsData] = await Promise.all([
          sessionRes.json(),
          permissionsRes.json(),
        ]);
        
        if (sessionData.success && sessionData.data) {
          setSession(sessionData.data);
        }
        
        if (permissionsData.success && permissionsData.data) {
          setEditPermissions(permissionsData.data);
        }
      } catch (err) {
        logger.error('Failed to fetch session:', err);
      } finally {
        setSessionLoading(false);
      }
    };
    fetchSessionAndPermissions();
  }, []);

  const fetchReports = useCallback(async () => {
    if (!session?.employeeId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        employeeId: session.employeeId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const response = await fetch(`/api/work-reports?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setReports(data.data.reports || []);
      } else {
        toast.error(data.error || 'Failed to fetch reports');
      }
    } catch {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [session?.employeeId, dateRange.start, dateRange.end]);

  const fetchCalendarReports = useCallback(async () => {
    if (!session?.employeeId) return;
    try {
      const y = getISTYear();
      const params = new URLSearchParams({
        employeeId: session.employeeId,
        startDate: `${y - 1}-01-01`,
        endDate: `${y + 1}-12-31`,
      });
      const response = await fetch(`/api/work-reports?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setCalendarReports(data.data.reports || []);
      }
    } catch (err) {
      logger.error('Failed to fetch calendar reports:', err);
    }
  }, [session?.employeeId]);

  useEffect(() => {
    if (session?.employeeId) {
      fetchCalendarReports();
    }
  }, [session?.employeeId, fetchCalendarReports]);

  useEffect(() => {
    if (session?.employeeId) {
      fetchReports();
    }
  }, [session?.employeeId, fetchReports]);

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setDateRange({ start, end });
  }, []);

  const handleResetDateFilter = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    setDateRange({
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${day}`,
    });
  }, []);

  // Fetch holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await fetch('/api/holidays?full=true');
        const data = await response.json();
        if (data.success) {
          setHolidays(data.data || []);
        }
      } catch (error) {
        logger.error('Failed to fetch holidays:', error);
      }
    };
    fetchHolidays();
  }, []);

  useEffect(() => {
    const fetchCheckpoints = async () => {
      try {
        const response = await fetch('/api/checkpoints/my');
        const data = await response.json();
        if (data.success) {
          setCheckpoints(data.data?.checkpoints || []);
        }
      } catch (error) {
        logger.error('Failed to fetch checkpoints:', error);
      }
    };
    fetchCheckpoints();
  }, []);

  const handleToggleCheckpoint = useCallback(async (employeeCheckpointId: number, isCompleted: boolean) => {
    try {
      const response = await fetch('/api/checkpoints/my', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCheckpointId, isCompleted: !isCompleted }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to update checklist');
        return;
      }
      setCheckpoints(prev =>
        prev.map(item => item.id === employeeCheckpointId ? { ...item, isCompleted: !isCompleted } : item)
      );
    } catch {
      toast.error('Failed to update checklist');
    }
  }, []);

  const formatChecklistDateTime = useCallback((value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }, []);

  const checklistStats = useMemo(() => {
    const total = checkpoints.length;
    const completed = checkpoints.filter((c) => c.isCompleted).length;
    const pending = total - completed;
    const recurringTotal = checkpoints.filter((c) => c.recurrenceType !== 'one_time').length;
    const limitedTotal = total - recurringTotal;
    return { total, completed, pending, recurringTotal, limitedTotal };
  }, [checkpoints]);

  const handleEditClick = useCallback((report: WorkReport) => {
    setEditingReport(report);
    setEditStatus(report.status);
    setEditWorkReport(report.workReport || '');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingReport(null);
    setEditStatus('working');
    setEditWorkReport('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingReport) return;

    if (editStatus === 'working' && !editWorkReport.trim()) {
      toast.error('Work report is required when status is "Working"');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/work-reports/${editingReport.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          workReport: editWorkReport.trim() || null,
          // The inline editor doesn't expose onDuty/halfday — pass through the
          // existing values so the API doesn't reset them to false.
          onDuty: editingReport.onDuty,
          halfday: editingReport.halfday,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Report updated successfully');
        setReports(prev => prev.map(r => 
          r.id === editingReport.id ? data.data : r
        ));
        setCalendarReports((prev) =>
          prev.map((r) => (r.id === editingReport.id ? data.data : r))
        );
        handleCancelEdit();
      } else {
        toast.error(data.error || 'Failed to update report');
      }
    } catch {
      toast.error('Failed to update report');
    } finally {
      setSaving(false);
    }
  }, [editingReport, editStatus, editWorkReport, handleCancelEdit]);

  const formatDate = useCallback((dateStr: string) => formatDateForDisplay(dateStr), []);
  const getShortDay = useCallback((dateStr: string) => getShortDayIST(dateStr), []);
  const getShortDate = useCallback((dateStr: string) => getShortDateIST(dateStr), []);

  const toggleExpand = useCallback((reportId: number) => {
    if (editingReport?.id === reportId) return;
    setExpandedReportId(prev => prev === reportId ? null : reportId);
  }, [editingReport?.id]);

  // Calculate stats
  const stats = useMemo(() => {
    const workingCount = reports.filter(r => r.status === 'working').length;
    const leaveCount = reports.filter(r => r.status === 'leave').length;
    const onDutyCount = reports.filter(r => r.onDuty).length;
    const attendanceRate = reports.length > 0 ? Math.round((workingCount / reports.length) * 100) : 0;
    return { workingCount, leaveCount, onDutyCount, attendanceRate, total: reports.length };
  }, [reports]);
  
  // Check if today's report is submitted (using IST)
  // Re-evaluate every minute so the day rolls over without a manual refresh.
  const [today, setToday] = useState<string>(() => getISTTodayDateString());
  useEffect(() => {
    const tick = () => setToday(getISTTodayDateString());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);
  const todayReport = useMemo(() => {
    const fromCalendar = calendarReports.find((r) => r.date === today);
    if (fromCalendar) return fromCalendar;
    return reports.find((r) => r.date === today);
  }, [calendarReports, reports, today]);

  // Helper function to check if report is a late submission
  const isLateSubmission = useCallback((report: WorkReport) => {
    try {
      const submissionDate = convertUTCToISTDate(report.createdAt);
      // A report is late only if submitted on a day AFTER the report date
      // Same day submissions (even at 11:59 PM IST) should NOT be marked as late
      // Compare dates as strings (YYYY-MM-DD format)
      const isLate = report.date < submissionDate;
      return isLate;
    } catch (error) {
      // If date conversion fails, don't mark as late (fail-safe)
      logger.error('Error checking late submission:', error);
      return false;
    }
  }, []);

  // Page-level session is still loading or AppShell already enforces login.
  // Render nothing until our own session fetch resolves so we don't try to render
  // session.name before it's available.
  if (sessionLoading || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
            <div className="rounded-md border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-[-0.01em]">Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Welcome back, {session.name.split(' ')[0]}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <ThemeToggle className="h-8 w-8 rounded-sm border border-border text-muted-foreground hover:bg-muted hover:text-foreground shrink-0" />
                  <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground hover:bg-muted"><Bell className="h-4 w-4" /></button>
                  <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground hover:bg-muted"><Settings className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div className="space-y-4 min-w-0">
          <div className="p-4 sm:p-6 rounded-md bg-card border shadow-sm">
            <div className="flex items-start gap-4 sm:gap-6">
              {/* Left Section - Profile Info */}
              <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-xl sm:text-2xl font-bold shadow-lg shadow-primary/20">
                    {session.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card flex items-center justify-center ${
                    todayReport 
                      ? 'bg-foreground' 
                      : 'bg-muted-foreground'
                  }`}>
                    {todayReport ? (
                      todayReport.status === 'working' 
                        ? <CheckCircle2 className="w-3 h-3 text-white" />
                        : <Coffee className="w-3 h-3 text-white" />
                    ) : (
                      <Clock className="w-3 h-3 text-white" />
                    )}
                  </div>
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-xl font-semibold truncate">Today&apos;s Report</h2>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mb-2">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{session.email}</span>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground bg-muted/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg">
                      <User className="h-3 w-3" />
                      {session.employeeId}
                    </span>
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground bg-muted/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg max-w-full">
                      <Building2 className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{session.department}</span>
                    </span>
                    {todayReport ? (
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-muted/50 text-foreground">
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Report Submitted</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Report Pending</span>
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                    {todayReport
                      ? `You marked ${todayReport.status === 'working' ? 'working' : 'leave'} for today.`
                      : 'Daily report is pending. You can submit it from the left sidebar.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
            {/* Total Reports */}
            <div className="p-3 sm:p-4 rounded-md bg-card border shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                <span className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">Total Reports</span>
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.total}</p>
            </div>

            {/* Working Days */}
            <div className="p-3 sm:p-4 rounded-md bg-card border shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                <span className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">Working Days</span>
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.workingCount}</p>
            </div>

            {/* On Duty */}
            <div className="p-3 sm:p-4 rounded-md bg-card border shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                <span className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">On Duty</span>
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.onDutyCount}</p>
            </div>

            {/* Leave Days */}
            <div className="p-3 sm:p-4 rounded-md bg-card border shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                <span className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">Leave Days</span>
                <Coffee className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.leaveCount}</p>
            </div>

            {/* Attendance Rate */}
            <div className="p-3 sm:p-4 rounded-md border shadow-sm bg-card col-span-2 sm:col-span-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                <span className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">Attendance</span>
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">
                {stats.attendanceRate}%
              </p>
            </div>
          </div>

          {/* Edit Permission Banner */}
          {canEditOwnReports && (
            <div className="mb-4 p-4 rounded-md bg-primary text-primary-foreground border border-primary">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                  <Pencil className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.06em]">Editing Enabled</p>
                  <p className="text-xs text-primary-foreground/70">You can edit your reports on the day they were created</p>
                </div>
              </div>
            </div>
          )}

          {/* Reports List */}
          <div className="rounded-md border bg-card shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 border-b bg-muted/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">Work Report History</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">Your submitted work reports</p>
              </div>
              {reports.length > 0 && (
                <span className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                  {reports.length}<span className="hidden sm:inline"> reports</span>
                </span>
              )}
            </div>

            <div className="px-3 sm:px-4 py-3 border-b bg-background/60">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Date Range</span>
                </div>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => handleDateRangeChange(e.target.value, dateRange.end)}
                  className="h-8 sm:h-9 w-full sm:w-40 text-xs sm:text-sm"
                />
                <span className="text-xs text-muted-foreground hidden sm:inline">to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => handleDateRangeChange(dateRange.start, e.target.value)}
                  className="h-8 sm:h-9 w-full sm:w-40 text-xs sm:text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetDateFilter}
                  className="h-8 sm:h-9 text-muted-foreground hover:text-foreground sm:ml-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset
                </Button>
              </div>
            </div>
            
            <div className="p-2 sm:p-3 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading reports...</p>
                  </div>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No Reports Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    You haven&apos;t submitted any work reports yet. Start by submitting your first report.
                  </p>
                  <Link href="/work-report">
                    <Button className="bg-gradient-to-r from-primary to-primary/80">
                      <Plus className="h-4 w-4 mr-2" />
                      Submit Your First Report
                    </Button>
                  </Link>
                </div>
              ) : (
                <div
                  className="max-h-[min(55vh,28rem)] sm:max-h-[min(65vh,40rem)] overflow-y-auto overscroll-y-contain rounded-md border border-border/40 bg-muted/5 -mx-0.5 px-2 sm:px-3 py-2"
                  role="region"
                  aria-label="Work report list"
                >
                  <div className="space-y-2">
                  {reports.map((report, index) => (
                    <div 
                      key={report.id}
                      id={`report-${report.id}`}
                      className="animate-fade-in"
                      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                    >
                      {/* Report Card */}
                      <div
                        onClick={() => toggleExpand(report.id)}
                        className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                          expandedReportId === report.id || editingReport?.id === report.id
                            ? 'bg-muted/50 shadow-sm'
                            : 'hover:bg-muted/30 cursor-pointer'
                        }`}
                      >
                        {/* Accent bar - black and white theme */}
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-foreground/10" />
                        
                        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3">
                          {/* Date Block - black and white theme */}
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex flex-col items-center justify-center flex-shrink-0 bg-foreground text-background">
                            <span className="text-[10px] sm:text-xs font-medium uppercase opacity-90">{getShortDay(report.date)}</span>
                            <span className="text-lg sm:text-xl font-bold leading-none">{getDayOfMonthIST(report.date)}</span>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                              <span className="text-sm font-medium">{getShortDate(report.date)}</span>
                              
                              {/* Status badges */}
                              <span className={`inline-flex items-center gap-1 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${
                                report.status === 'working' 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              }`}>
                                {report.status === 'working' ? (
                                  <><CheckCircle2 className="w-3 h-3" /> Working</>
                                ) : (
                                  <><Coffee className="w-3 h-3" /> Leave</>
                                )}
                              </span>
                              
                              {report.onDuty && (
                                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  <Shield className="w-3 h-3" /> Duty
                                </span>
                              )}
                              
                              {report.halfday && (
                                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                                  <Calendar className="w-3 h-3" /> Half
                                </span>
                              )}
                              
                              {isLateSubmission(report) && (
                                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                                  <Clock className="w-3 h-3" /> Late
                                </span>
                              )}
                            </div>
                            
                            {/* Preview */}
                            {report.workReport && expandedReportId !== report.id && editingReport?.id !== report.id && (
                              <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1 break-words">
                                {report.workReport}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                            {canEditReport(report) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(report);
                                  setExpandedReportId(report.id);
                                }}
                                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${
                              expandedReportId === report.id || editingReport?.id === report.id ? 'rotate-180' : ''
                            }`} />
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {(expandedReportId === report.id || editingReport?.id === report.id) && (
                          <div className="px-3 sm:px-4 pb-4 pt-2 animate-fade-in">
                            <div className="pl-[60px] sm:pl-[74px]">
                              <div className="pl-3 sm:pl-4 border-l-2 border-border">
                                {editingReport?.id === report.id ? (
                                  <div className="space-y-3 sm:space-y-4 py-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                      <span className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">{formatDate(report.date)}</span>
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={saving} className="h-8 px-3 flex-1 sm:flex-none">
                                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          onClick={handleSaveEdit} 
                                          disabled={saving}
                                          className="h-8 px-4 bg-foreground text-background hover:bg-foreground/90 flex-1 sm:flex-none"
                                        >
                                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" /> Save</>}
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium">Status</Label>
                                      <div className="grid grid-cols-2 gap-3 max-w-md">
                                        <button
                                          type="button"
                                          onClick={() => setEditStatus('working')}
                                          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                            editStatus === 'working'
                                              ? 'bg-foreground text-background ring-2 ring-foreground/30'
                                              : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border'
                                          }`}
                                        >
                                          <Briefcase className="h-4 w-4" /> Working
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditStatus('leave')}
                                          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                            editStatus === 'leave'
                                              ? 'bg-foreground text-background ring-2 ring-foreground/30'
                                              : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border'
                                          }`}
                                        >
                                          <Coffee className="h-4 w-4" /> Leave
                                        </button>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium">
                                        Work Report {editStatus === 'working' && <span className="text-destructive">*</span>}
                                      </Label>
                                      <textarea
                                        value={editWorkReport}
                                        onChange={(e) => setEditWorkReport(e.target.value)}
                                        placeholder={editStatus === 'working' ? 'Describe your work...' : 'Optional notes...'}
                                        className="flex min-h-28 w-full max-w-2xl rounded-xl border border-input bg-background/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="py-2">
                                    {report.workReport ? (
                                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                                        {report.workReport}
                                      </p>
                                    ) : (
                                      <p className="text-sm text-muted-foreground italic">No details provided</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          </div>
            </div>

            <div className="space-y-4 xl:sticky xl:top-20 h-fit">
              <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                <div className="p-3 sm:p-4 border-b bg-muted/30">
                  <h3 className="font-semibold text-sm uppercase tracking-[0.06em]">Assigned Checklist</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    Checkpoints assigned by your manager or team head.
                  </p>
                </div>
                <div className="p-3 sm:p-4 border-b">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-sm border bg-muted/20 p-2">
                      <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Completed (current period)</p>
                      <p className="text-lg font-semibold">{checklistStats.completed}/{checklistStats.total}</p>
                    </div>
                    <div className="rounded-sm border bg-muted/20 p-2">
                      <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Pending</p>
                      <p className="text-lg font-semibold">{checklistStats.pending}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Recurring: {checklistStats.recurringTotal} • Limited/one-time: {checklistStats.limitedTotal}
                  </p>
                </div>
                <div className="p-3 sm:p-4 space-y-2">
                  {checkpoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No checklist items assigned yet.</p>
                  ) : (
                    checkpoints.map((item) => (
                      <label key={item.id} className="flex items-start gap-2 rounded-sm border p-2.5 cursor-pointer bg-muted/20">
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => handleToggleCheckpoint(item.id, item.isCompleted)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          <span className={`font-medium ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
                          {item.description ? <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span> : null}
                          <span className="block text-[11px] text-muted-foreground mt-1">
                            {item.recurrenceType === 'one_time' ? 'Limited time / one-time' : `Recurring - ${item.recurrenceType}`}
                          </span>
                          {(item.startsAt || item.endsAt || item.dueAt || item.startsOn || item.endsOn || item.dueDate) ? (
                            <span className="block text-[11px] text-muted-foreground">
                              {item.recurrenceType === 'one_time'
                                ? `${formatChecklistDateTime(item.startsAt ?? item.startsOn) || '-'} -> ${formatChecklistDateTime(item.endsAt ?? item.endsOn) || '-'}`
                                : `Due ${formatChecklistDateTime(item.dueAt ?? item.dueDate) || '-'}`
                              }
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <WorkReportCalendar 
                reports={calendarReports}
                holidays={holidays}
                onDateClick={(date) => {
                  const report = calendarReports.find(r => r.date === date);
                  if (!report) return;
                  const inList = reports.some((r) => r.id === report.id);
                  if (inList) {
                    setExpandedReportId(report.id);
                    document.getElementById(`report-${report.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    toast.message('This date is outside your list filter. Widen the date range above to open that report here.');
                  }
                }}
              />
            </div>
          </div>
    </section>
  );
}
