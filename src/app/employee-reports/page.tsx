'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Loader2, Search, FileText, Briefcase, Coffee, ArrowRight, Lock, Pencil, X, Check, 
  ChevronDown, Filter, Users, Calendar, AlertCircle, Shield, LayoutGrid, List, UserCheck, RotateCcw,
  TrendingUp, Clock, CheckCircle2, CalendarDays, Building2, Sparkles, Bell, CircleHelp, Settings, LogOut, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import type { WorkReport, SessionUser, WorkStatus, EditPermissions, Department, Holiday } from '@/types';
import { getISTDateRangeFromDays, getISTTodayDateString, getShortDayIST, getShortDateIST, formatDateForDisplay, convertUTCToISTDate } from '@/lib/date';
import { logger } from '@/lib/logger';
import { WorkReportCalendar } from '@/components/work-report-calendar';
import { canMarkAttendance } from '@/lib/permissions';

export default function EmployeeReportsPage() {
  const pathname = usePathname();
  const isTeamReportPage = pathname === '/team-report';
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [allReports, setAllReports] = useState<WorkReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'working' | 'leave'>('all');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  
  const getDefaultDates = useCallback(() => getISTDateRangeFromDays(7), []);
  const [dateRange, setDateRange] = useState(() => getISTDateRangeFromDays(7));

  // Edit state
  const [editingReport, setEditingReport] = useState<WorkReport | null>(null);
  const [editStatus, setEditStatus] = useState<WorkStatus>('working');
  const [editWorkReport, setEditWorkReport] = useState('');
  const [saving, setSaving] = useState(false);
  const [editPermissions, setEditPermissions] = useState<EditPermissions | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);

  // Scrum board state
  const [managerDepartments, setManagerDepartments] = useState<Department[]>([]);
  const [viewMode, setViewMode] = useState<'scrum' | 'list'>('scrum');
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const canSearchOthers = session?.role === 'admin' || session?.role === 'superadmin' || session?.role === 'manager' || session?.role === 'teamhead';
  const isManager = session?.role === 'manager' || session?.role === 'teamhead';
  const isSingleDept = managerDepartments.length === 1;

  useEffect(() => {
    if (!sessionLoading && session && session.role === 'employee') {
      window.location.href = '/employee-dashboard';
    }
  }, [sessionLoading, session]);
  
  const canEdit = useCallback((report: WorkReport) => {
    if (!session || !editPermissions) return false;
    const isOwnReport = report.employeeId === session.employeeId;
    let hasPermission = false;
    
    if (session.role === 'superadmin') {
      hasPermission = editPermissions.superadmin_can_edit_reports;
    } else if (session.role === 'admin') {
      hasPermission = editPermissions.admin_can_edit_reports;
    } else if (session.role === 'employee' && isOwnReport) {
      hasPermission = editPermissions.employee_can_edit_own_reports;
    } else if (session.role === 'manager' || session.role === 'teamhead') {
      // Managers/team heads can edit their own reports when employee_can_edit_own_reports is enabled
      if (isOwnReport && editPermissions.employee_can_edit_own_reports) {
        hasPermission = true;
      } else if (editPermissions.manager_can_edit_team_reports) {
        // Managers can edit team members' reports if permission is enabled
        // Check if the employee's department is in manager's assigned departments
        const isTeamMember = managerDepartments.some(dept => dept.name === report.department);
        hasPermission = isTeamMember;
      }
    }
    
    if (!hasPermission) return false;
    
    const createdDate = convertUTCToISTDate(report.createdAt);
    const todayDate = getISTTodayDateString();
    return createdDate === todayDate;
  }, [session, editPermissions, managerDepartments]);

  const fetchReports = useCallback(async (query?: string, dept?: string, startDate?: string, endDate?: string) => {
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const params = new URLSearchParams();
      if (query && query.trim()) params.append('search', query.trim());
      if (dept && dept !== 'all') params.append('department', dept);
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      
      const response = await fetch(`/api/work-reports?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        const fetchedReports: WorkReport[] = data.data.reports || [];
        setAllReports(fetchedReports);
        // Reports will be filtered by useEffect based on statusFilter
      } else {
        setError(data.error || 'Failed to fetch reports');
        setReports([]);
        setAllReports([]);
      }
    } catch {
      setError('Failed to fetch reports');
      setReports([]);
      setAllReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
          
          if (sessionData.data.role === 'manager' || sessionData.data.role === 'teamhead') {
            try {
              const deptRes = await fetch('/api/managers/departments');
              const deptData = await deptRes.json();
              if (deptData.success && deptData.data) {
                setManagerDepartments(deptData.data);
              }
            } catch (err) {
              logger.error('Failed to fetch manager departments:', err);
            }
          }
          
          const canSearch = sessionData.data.role === 'admin' || 
                           sessionData.data.role === 'superadmin' || 
                           sessionData.data.role === 'manager' ||
                           sessionData.data.role === 'teamhead';
          if (canSearch) {
            const deptRes = await fetch('/api/work-reports?getDepartments=true');
            const deptData = await deptRes.json();
            if (deptData.success && deptData.data?.departments) {
              setDepartments(deptData.data.departments);
              if (sessionData.data.role === 'manager' || sessionData.data.role === 'teamhead') {
                const todayDates = getDefaultDates();
                setDateRange(todayDates);
                fetchReports('', 'all', todayDates.start, todayDates.end);
              }
            }
          }
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

  const handleSearch = useCallback(() => {
    fetchReports(searchQuery, selectedDepartment, dateRange.start, dateRange.end);
  }, [searchQuery, selectedDepartment, dateRange.start, dateRange.end, fetchReports]);

  const handleDepartmentChange = useCallback((dept: string) => {
    setSelectedDepartment(dept);
    fetchReports(searchQuery, dept, dateRange.start, dateRange.end);
  }, [searchQuery, dateRange.start, dateRange.end, fetchReports]);

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setDateRange({ start, end });
    fetchReports(searchQuery, selectedDepartment, start, end);
  }, [searchQuery, selectedDepartment, fetchReports]);

  const handleStatusFilter = useCallback((status: 'all' | 'working' | 'leave') => {
    setStatusFilter(status);
  }, []);
  
  // Update reports when status filter or allReports changes
  useEffect(() => {
    if (statusFilter === 'all') {
      setReports(allReports);
    } else {
      setReports(allReports.filter(r => r.status === statusFilter));
    }
  }, [statusFilter, allReports]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedDepartment('all');
    setStatusFilter('all');
    const todayDates = getISTDateRangeFromDays(7);
    setDateRange(todayDates);
    fetchReports('', 'all', todayDates.start, todayDates.end);
  }, [fetchReports]);

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

    // Check if this is the employee editing their own report
    const isOwnReport = editingReport.employeeId === session?.employeeId;
    const isManagerEditingTeamMember = session?.role === 'manager' && !isOwnReport;

    // Work report is required only if:
    // 1. Employee is editing their own report and status is working
    // 2. Not a manager editing team member (managers can mark as working without work report)
    if (editStatus === 'working' && !editWorkReport.trim() && !isManagerEditingTeamMember) {
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
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Report updated successfully');
        setReports(prev => prev.map(r => r.id === editingReport.id ? data.data : r));
        setAllReports(prev => prev.map(r => r.id === editingReport.id ? data.data : r));
        handleCancelEdit();
      } else {
        toast.error(data.error || 'Failed to update report');
      }
    } catch {
      toast.error('Failed to update report');
    } finally {
      setSaving(false);
    }
  }, [editingReport, editStatus, editWorkReport, handleCancelEdit, session]);

  const formatDate = useCallback((dateStr: string) => formatDateForDisplay(dateStr), []);
  const getShortDay = useCallback((dateStr: string) => getShortDayIST(dateStr), []);
  const getShortDate = useCallback((dateStr: string) => getShortDateIST(dateStr), []);

  const toggleExpand = useCallback((reportId: number) => {
    if (editingReport?.id === reportId) return;
    setExpandedReportId(prev => prev === reportId ? null : reportId);
  }, [editingReport?.id]);

  // Stats calculations
  const stats = useMemo(() => {
  const workingReports = allReports.filter(r => r.status === 'working');
  const workingCount = [...new Set(workingReports.map(r => r.date))].length;
    const leaveCount = allReports.filter(r => r.status === 'leave').length;
  const onDutyCount = allReports.filter(r => r.onDuty).length;
  const uniqueEmployees = [...new Set(allReports.map(r => r.employeeId))].length;
  
    return { workingCount, leaveCount, onDutyCount, uniqueEmployees, total: reports.length };
  }, [allReports, reports]);
  
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

  const groupReportsByDate = useCallback((reports: WorkReport[]) => {
    return reports.reduce((acc, report) => {
      if (!acc[report.date]) acc[report.date] = [];
      acc[report.date].push(report);
      return acc;
    }, {} as Record<string, WorkReport[]>);
  }, []);

  const groupReportsByDateAndDept = useCallback((reports: WorkReport[]) => {
    return reports.reduce((acc, report) => {
      if (!acc[report.date]) acc[report.date] = {};
      if (!acc[report.date][report.department]) acc[report.date][report.department] = [];
      acc[report.date][report.department].push(report);
      return acc;
    }, {} as Record<string, Record<string, WorkReport[]>>);
  }, []);

  const getAllDatesInRange = useCallback((startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }, []);

  // Glassmorphic design - Black and white theme for departments
  const departmentColors = useMemo(() => {
    // All departments use the same glassmorphic black/white design
    // Visual distinction comes from subtle variations in opacity and borders
    const variations = [
      { bg: 'from-card/80 to-card/50 backdrop-blur-sm', border: 'border-border/50', accent: 'bg-foreground/10', text: 'text-foreground', badge: 'bg-foreground/10 text-foreground' },
      { bg: 'from-card/70 to-card/40 backdrop-blur-sm', border: 'border-border/60', accent: 'bg-foreground/15', text: 'text-foreground', badge: 'bg-foreground/10 text-foreground' },
      { bg: 'from-card/90 to-card/60 backdrop-blur-sm', border: 'border-border/40', accent: 'bg-foreground/8', text: 'text-foreground', badge: 'bg-foreground/10 text-foreground' },
      { bg: 'from-card/75 to-card/45 backdrop-blur-sm', border: 'border-border/55', accent: 'bg-foreground/12', text: 'text-foreground', badge: 'bg-foreground/10 text-foreground' },
      { bg: 'from-card/85 to-card/55 backdrop-blur-sm', border: 'border-border/45', accent: 'bg-foreground/9', text: 'text-foreground', badge: 'bg-foreground/10 text-foreground' },
      { bg: 'from-card/80 to-card/50 backdrop-blur-sm', border: 'border-border/50', accent: 'bg-foreground/10', text: 'text-foreground', badge: 'bg-foreground/10 text-foreground' },
    ];
    const colorMap = new Map<string, typeof variations[0]>();
    managerDepartments.forEach((dept, index) => {
      colorMap.set(dept.name, variations[index % variations.length]);
    });
    return colorMap;
  }, [managerDepartments]);

  // Modern Work Report Card
  const WorkReportCard = ({ report, compact = false }: { report: WorkReport; compact?: boolean }) => {
    const isExpanded = expandedReportId === report.id || editingReport?.id === report.id;
    const isEditing = editingReport?.id === report.id;
    
    return (
      <div
        onClick={() => toggleExpand(report.id)}
        className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
          compact ? 'p-3' : 'p-4'
        } ${
          isExpanded 
            ? 'bg-card shadow-lg ring-1 ring-foreground/5' 
            : 'bg-card/50 hover:bg-card hover:shadow-md cursor-pointer'
        }`}
      >
        {/* Accent bar - black and white theme */}
        <div className="absolute top-0 left-0 w-full h-1 bg-foreground/10" />
        
        <div className="flex items-start gap-3">
          {/* Avatar with status ring - black and white theme */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-foreground text-background">
              {report.name?.charAt(0).toUpperCase() || 'E'}
            </div>
            {report.onDuty && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-card">
                <Shield className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Name & ID */}
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm truncate">{report.name}</h4>
              <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                {report.employeeId}
              </span>
            </div>
            
            {/* Status badges */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
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
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Shield className="w-3 h-3" /> On Duty
                </span>
              )}
              
              {report.halfday && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                  <Calendar className="w-3 h-3" /> Halfday
                </span>
              )}
              
              {isLateSubmission(report) && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                  <Clock className="w-3 h-3" /> Late
                </span>
              )}
            </div>
            
            {/* Work report preview */}
            {report.workReport && !isExpanded && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {report.workReport}
              </p>
            )}
            
            {/* Expanded content */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-border/50 animate-fade-in">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatDate(report.date)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                          disabled={saving}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                          disabled={saving}
                          className="h-7 px-3 text-xs bg-foreground text-background hover:bg-foreground/90"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" /> Save</>}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Status</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditStatus('working'); }}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            editStatus === 'working'
                              ? 'bg-foreground text-background ring-1 ring-foreground/30'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5" /> Working
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditStatus('leave'); }}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            editStatus === 'leave'
                              ? 'bg-foreground text-background ring-1 ring-foreground/30'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border'
                          }`}
                        >
                          <Coffee className="w-3.5 h-3.5" /> Leave
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">
                        Work Report {
                          editStatus === 'working' && 
                          editingReport.employeeId === session?.employeeId && 
                          <span className="text-red-500">*</span>
                        }
                        {editStatus === 'working' && 
                         editingReport.employeeId !== session?.employeeId && 
                         session?.role === 'manager' && 
                         <span className="text-xs text-muted-foreground ml-1">(Optional - Employee will add later)</span>
                        }
                      </Label>
                      <textarea
                        value={editWorkReport}
                        onChange={(e) => setEditWorkReport(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder={
                          editStatus === 'working' 
                            ? (editingReport.employeeId === session?.employeeId 
                                ? 'Describe your work...' 
                                : 'Employee will submit their work report...')
                            : 'Optional notes...'
                        }
                        className="flex min-h-24 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    {report.workReport ? (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {report.workReport}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No details provided</p>
                    )}
                    {canEdit(report) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleEditClick(report); setExpandedReportId(report.id); }}
                        className="mt-3 h-7 px-3 text-xs"
                      >
                        <Pencil className="w-3 h-3 mr-1.5" /> Edit Report
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Expand indicator */}
          {!compact && !isExpanded && (
            <ChevronDown className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
          )}
        </div>
      </div>
    );
  };

  // Loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Login Required</h1>
          <p className="text-muted-foreground mb-6">Please login to view work reports.</p>
          <Button onClick={() => window.location.href = '/login'} className="btn-shine">
            Go to Login <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-12 bg-background">
      <div className="px-3 sm:px-4 md:px-6 py-4 max-w-full">
        <div className={`${isTeamReportPage ? 'grid gap-4 lg:grid-cols-[220px_1fr]' : 'w-full'}`}>
          {isTeamReportPage && (
            <aside className="hidden lg:flex lg:flex-col rounded-md border border-primary/30 bg-primary text-primary-foreground overflow-hidden min-h-[calc(100vh-7.5rem)]">
              <div className="px-5 py-4 border-b border-primary-foreground/10">
                <h2 className="text-2xl font-semibold leading-none">Work Report</h2>
                <p className="text-[11px] mt-1 uppercase tracking-[0.08em] text-primary-foreground/70">Enterprise Analytics</p>
              </div>
              <nav className="px-2 py-3 space-y-1">
                <Link href="/employee-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                  <Activity className="h-4 w-4" /> Dashboard
                </Link>
                <Link href="/team-report" className="flex items-center gap-3 rounded-sm bg-primary-foreground/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em]">
                  <FileText className="h-4 w-4" /> Reports
                </Link>
                <Link href="/manage-team" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                  <Users className="h-4 w-4" /> Team Management
                </Link>
                <Link href="/management-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                  <TrendingUp className="h-4 w-4" /> Analytics
                </Link>
                <Link href="/admin" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                  <Shield className="h-4 w-4" /> Admin Portal
                </Link>
              </nav>
              <div className="mt-auto px-2 py-3 border-t border-primary-foreground/10 space-y-1">
                <div className="mb-2 flex items-center justify-between rounded-sm border border-primary-foreground/20 px-3 py-2 text-xs uppercase tracking-[0.06em] text-primary-foreground/80">
                  Theme
                  <ThemeToggle />
                </div>
                <button className="w-full flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                  <CircleHelp className="h-4 w-4" /> Support
                </button>
                <button className="w-full flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </aside>
          )}

          <div className={`w-full ${session?.role === 'employee' ? 'grid gap-6 lg:grid-cols-[1fr_400px]' : ''}`}>
            <div className={session?.role === 'employee' ? '' : `${isManager && viewMode === 'scrum' ? 'max-w-[1600px]' : 'max-w-6xl'} mx-auto`}>
              {isTeamReportPage && (
                <div className="rounded-md border bg-card px-4 py-3 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-[250px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search reports, team members, or IDs..."
                          className="pl-9 h-9 bg-muted/30 border-0"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Bell className="h-4 w-4" /></button>
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><CircleHelp className="h-4 w-4" /></button>
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Settings className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              )}
          
          {/* Header Section */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                {canSearchOthers
                      ? session?.role === 'manager' ? 'Team Reports' : 'Employee Reports'
                  : 'My Work Reports'}
              </h1>
                  <p className="text-sm text-muted-foreground">
                {canSearchOthers 
                  ? session?.role === 'manager'
                        ? 'Monitor and manage your team\'s daily work updates'
                        : 'View and manage employee work history' 
                      : 'Track your work report submissions'}
                  </p>
                </div>
              </div>

            </div>
            {canMarkAttendance(session) && (
              <div className="mt-4">
                <Button
                  onClick={() => (window.location.href = '/mark-attendance')}
                  className="gap-2"
                  variant="outline"
                >
                  <UserCheck className="h-4 w-4" />
                  Mark Attendance
                </Button>
              </div>
            )}
          </div>

          {/* Search & Filters Section */}
          {canSearchOthers && (
            <div className="mb-5 p-4 rounded-md bg-card border shadow-sm">
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <div className="flex-1 relative min-w-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by name, ID, or department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-11 h-10 w-full min-w-0 bg-background border-input focus:border-primary rounded-sm"
                    />
                  </div>
                  <Button 
                    onClick={handleSearch} 
                    disabled={loading} 
                    className="h-10 shrink-0 px-5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" /> Search</>}
                  </Button>
                </div>
                
                {/* Filter Row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span>Filters:</span>
                  </div>
                  
                  {/* Department */}
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={selectedDepartment}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="h-9 pl-9 pr-8 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                  
                  {/* Date Range */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 bg-muted/30 rounded-sm p-2 sm:p-1 w-full sm:w-auto min-w-0">
                    <div className="relative w-full sm:w-auto min-w-0">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => handleDateRangeChange(e.target.value, dateRange.end)}
                        className="h-9 sm:h-8 pl-9 w-full min-w-0 max-w-full sm:w-36 text-sm bg-background border-0"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline text-center">to</span>
                      <Input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => handleDateRangeChange(dateRange.start, e.target.value)}
                      className="h-9 sm:h-8 w-full min-w-0 max-w-full sm:w-36 text-sm bg-background border-0"
                      />
                  </div>
                  
                  {/* Reset Filters */}
                  {(searchQuery || selectedDepartment !== 'all' || statusFilter !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                    </Button>
                  )}
                </div>
                  </div>
              {error && <p className="text-sm text-destructive mt-3 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</p>}
            </div>
          )}

          {/* Loading for regular employees */}
          {!canSearchOthers && loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Results Section */}
          {searched && !loading && (
            <>
              {reports.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-16 text-center bg-card/50">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No Reports Found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {searchQuery 
                      ? <>No reports matching &quot;{searchQuery}&quot;</>
                      : 'No work reports found for the selected criteria.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                    <div className="p-4 rounded-md bg-card border shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Total Reports</span>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                      <p className="text-3xl font-bold">{stats.total}</p>
                    </div>
                    
                    <button
                      onClick={() => handleStatusFilter(statusFilter === 'working' ? 'all' : 'working')}
                      className={`p-4 rounded-md border shadow-sm transition-all text-left ${
                        statusFilter === 'working' 
                          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10' 
                          : 'bg-card hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Working Days</span>
                        <TrendingUp className={`h-4 w-4 ${statusFilter === 'working' ? 'text-emerald-500' : 'text-emerald-500/60'}`} />
                      </div>
                      <p className={`text-3xl font-bold ${statusFilter === 'working' ? 'text-emerald-600 dark:text-emerald-400' : 'text-emerald-600'}`}>
                        {stats.workingCount}
                      </p>
                    </button>
                    
                    <div className="p-4 rounded-md bg-card border shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">On Duty</span>
                        <Shield className="h-4 w-4 text-blue-500" />
                      </div>
                      <p className="text-3xl font-bold text-blue-600">{stats.onDutyCount}</p>
                    </div>
                    
                    <button
                      onClick={() => handleStatusFilter(statusFilter === 'leave' ? 'all' : 'leave')}
                      className={`p-4 rounded-md border shadow-sm transition-all text-left ${
                        statusFilter === 'leave' 
                          ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/10' 
                          : 'bg-card hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Total Leaves</span>
                        <Coffee className={`h-4 w-4 ${statusFilter === 'leave' ? 'text-amber-500' : 'text-amber-500/60'}`} />
                      </div>
                      <p className={`text-3xl font-bold ${statusFilter === 'leave' ? 'text-amber-600 dark:text-amber-400' : 'text-amber-600'}`}>
                        {stats.leaveCount}
                      </p>
                    </button>
                    
                    <div className="p-4 rounded-md bg-card border shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Employees</span>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-3xl font-bold">{stats.uniqueEmployees}</p>
                    </div>
                  </div>

                  {/* View Mode Toggle */}
                  {isManager && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                      <div className="flex items-start sm:items-center gap-2 text-sm text-muted-foreground min-w-0">
                        <Sparkles className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                        <span className="break-words">
                          Showing {reports.length} reports from {getShortDateIST(dateRange.start)} to {getShortDateIST(dateRange.end)}
                        </span>
                      </div>
                      <div className="flex items-center bg-muted/50 rounded-sm p-1 shrink-0 self-start sm:self-auto border">
                        <button
                          onClick={() => setViewMode('scrum')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            viewMode === 'scrum' 
                              ? 'bg-card shadow-sm text-foreground border rounded-sm' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <LayoutGrid className="h-4 w-4" /> Board
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            viewMode === 'list' 
                              ? 'bg-card shadow-sm text-foreground border rounded-sm' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <List className="h-4 w-4" /> List
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Scrum Board View */}
                  {isManager && viewMode === 'scrum' && managerDepartments.length > 0 && (
                    <div className="mb-8">
                      {isSingleDept ? (
                        <div className="overflow-x-auto pb-4 -mx-4 px-4">
                          <div className="flex gap-4 min-w-max">
                            {(() => {
                              const reportsByDate = groupReportsByDate(reports);
                              const allDates = getAllDatesInRange(dateRange.start, dateRange.end);
                              const deptColor = managerDepartments[0] ? departmentColors.get(managerDepartments[0].name) : null;
                              
                              return allDates.map(date => {
                                const dateReports = reportsByDate[date] || [];
                                const isToday = date === getISTTodayDateString();
                                
                                return (
                                  <div key={date} className="w-80 flex-shrink-0">
                                    {/* Column Header */}
                                    <div className={`sticky top-0 z-10 p-4 rounded-t-xl border-b-2 backdrop-blur-sm bg-gradient-to-r ${deptColor?.bg || 'from-muted/50 to-muted'} ${deptColor?.border || 'border-border'}`}>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className={`text-base font-bold ${isToday ? 'text-primary' : ''}`}>
                                            {getShortDay(date)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">{getShortDate(date)}</p>
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                                          isToday 
                                            ? 'bg-primary text-primary-foreground' 
                                            : dateReports.length > 0 
                                              ? deptColor?.badge || 'bg-muted text-muted-foreground'
                                              : 'bg-muted/50 text-muted-foreground'
                                        }`}>
                                          {dateReports.length} {dateReports.length === 1 ? 'report' : 'reports'}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Cards Container */}
                                    <div className={`p-3 space-y-2 min-h-[300px] rounded-b-xl border border-t-0 ${deptColor?.border || 'border-border'} bg-gradient-to-b ${deptColor?.bg || 'from-muted/20 to-transparent'}`}>
                                      {dateReports.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                                            <FileText className="w-5 h-5 text-muted-foreground/50" />
                                          </div>
                                          <p className="text-xs text-muted-foreground">No reports yet</p>
                                        </div>
                                      ) : (
                                        dateReports.map(report => (
                                          <WorkReportCard key={report.id} report={report} compact />
                                        ))
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      ) : (
                        /* Multi-Department Grid */
                        <div className="overflow-x-auto rounded-xl border shadow-sm">
                          <table className="w-full border-collapse bg-card">
                            <thead>
                              <tr>
                                <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur-sm border-r border-b p-4 text-left text-sm font-semibold min-w-[120px]">
                                  <div className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                  Date
                                  </div>
                                </th>
                                {managerDepartments.map(dept => {
                                  const color = departmentColors.get(dept.name);
                                  return (
                                    <th
                                      key={dept.id}
                                      className={`sticky top-0 z-10 p-4 text-center text-sm font-semibold border-b-2 min-w-[280px] bg-gradient-to-r ${color?.bg || 'from-muted to-muted'} ${color?.border || 'border-border'}`}
                                    >
                                      <div className="flex items-center justify-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${color?.accent || 'bg-muted-foreground'}`} />
                                      {dept.name}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const reportsByDateAndDept = groupReportsByDateAndDept(reports);
                                const allDates = getAllDatesInRange(dateRange.start, dateRange.end);
                                
                                return allDates.map(date => {
                                  const isToday = date === getISTTodayDateString();
                                  
                                  return (
                                    <tr key={date} className="hover:bg-muted/30 transition-colors">
                                      <td className={`sticky left-0 z-10 border-r p-4 text-sm font-medium min-w-[120px] ${
                                        isToday ? 'bg-primary/5' : 'bg-card'
                                      }`}>
                                        <div className="flex items-center gap-2">
                                          {isToday && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                                        <div>
                                            <p className={`font-semibold ${isToday ? 'text-primary' : ''}`}>{getShortDay(date)}</p>
                                          <p className="text-xs text-muted-foreground">{getShortDate(date)}</p>
                                          </div>
                                        </div>
                                      </td>
                                      {managerDepartments.map(dept => {
                                        const color = departmentColors.get(dept.name);
                                        const deptReports = reportsByDateAndDept[date]?.[dept.name] || [];
                                        
                                        return (
                                          <td key={dept.id} className={`p-2 align-top border-r bg-gradient-to-b ${color?.bg || 'from-muted/10 to-transparent'}`}>
                                            <div className="space-y-2 min-h-[100px]">
                                              {deptReports.length === 0 ? (
                                                <div className="flex items-center justify-center py-8 text-center">
                                                  <span className="text-xs text-muted-foreground/50">—</span>
                                                </div>
                                              ) : (
                                                deptReports.map(report => (
                                                  <WorkReportCard key={report.id} report={report} compact />
                                                ))
                                              )}
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* List View */}
                  {(!isManager || viewMode === 'list') && (
                    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Work Reports
                        </h3>
                        {statusFilter !== 'all' && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            statusFilter === 'working' 
                              ? 'bg-emerald-500/10 text-emerald-600' 
                              : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {statusFilter === 'working' ? 'Working only' : 'Leave only'}
                          </span>
                        )}
                    </div>
                      <div className="divide-y divide-border/50">
                      {reports.map((report, index) => (
                        <div 
                          key={report.id} 
                          className="animate-fade-in"
                          style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                        >
                          <div
                            onClick={() => toggleExpand(report.id)}
                              className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-all ${
                              expandedReportId === report.id || editingReport?.id === report.id
                                  ? 'bg-muted/50'
                                  : 'hover:bg-muted/30'
                              }`}
                            >
                              {/* Status Bar - black and white theme */}
                              <div className="w-1 h-12 rounded-full flex-shrink-0 bg-foreground/20" />
                            
                              {/* Avatar - black and white theme */}
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 bg-foreground text-background">
                                {report.name?.charAt(0).toUpperCase() || 'E'}
                              </div>
                              
                              {/* Info */}
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="min-w-0 w-36">
                                <p className="text-sm font-medium truncate">{report.name}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{report.employeeId}</p>
                              </div>
                              
                                <div className="hidden md:block text-xs text-muted-foreground w-28 truncate">
                                {report.department}
                              </div>
                              
                                <div className="text-center flex-shrink-0 w-16">
                                  <p className="text-xs font-bold uppercase">{getShortDay(report.date)}</p>
                                  <p className="text-xs text-muted-foreground">{getShortDate(report.date)}</p>
                              </div>
                              
                                {/* Status badges */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                report.status === 'working' 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              }`}>
                                {report.status === 'working' ? 'Working' : 'Leave'}
                              </span>
                              
                              {report.onDuty && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                  <Shield className="h-3 w-3" /> Duty
                                </span>
                              )}
                              
                              {report.halfday && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> Halfday
                                </span>
                              )}
                              
                              {isLateSubmission(report) && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-600 dark:text-red-400 flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> Late
                                </span>
                              )}
                                </div>

                                {/* Preview */}
                              {report.workReport && expandedReportId !== report.id && editingReport?.id !== report.id && (
                                <p className="text-xs text-muted-foreground truncate flex-1 hidden lg:block">
                                    {report.workReport.substring(0, 60)}{report.workReport.length > 60 ? '...' : ''}
                                </p>
                              )}
                            </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                              {canEdit(report) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(report);
                                    setExpandedReportId(report.id);
                                  }}
                                    className="h-8 w-8 p-0"
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
                              <div className="px-4 pb-4 pt-2 ml-16 animate-fade-in">
                                <div className="pl-4 border-l-2 border-border">
                              {editingReport?.id === report.id ? (
                                    <div className="space-y-4 py-2">
                                  <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                          <CalendarDays className="h-4 w-4" />
                                          {formatDate(report.date)}
                                        </span>
                                    <div className="flex items-center gap-2">
                                          <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={saving} className="h-8 px-3">
                                            <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleSaveEdit}
                                        disabled={saving}
                                            className="h-8 px-4 bg-foreground text-background hover:bg-foreground/90"
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
                                      Work Report {
                                        editStatus === 'working' && 
                                        editingReport.employeeId === session?.employeeId && 
                                        <span className="text-destructive">*</span>
                                      }
                                      {editStatus === 'working' && 
                                       editingReport.employeeId !== session?.employeeId && 
                                       session?.role === 'manager' && 
                                       <span className="text-xs text-muted-foreground ml-1">(Optional - Employee will add later)</span>
                                      }
                                    </Label>
                                    <textarea
                                      value={editWorkReport}
                                      onChange={(e) => setEditWorkReport(e.target.value)}
                                          placeholder={
                                            editStatus === 'working' 
                                              ? (editingReport.employeeId === session?.employeeId 
                                                  ? 'Describe your work...' 
                                                  : 'Employee will submit their work report...')
                                              : 'Optional notes...'
                                          }
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
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Initial State for Admins */}
          {canSearchOthers && !searched && !loading && (
            <div className="rounded-2xl border border-dashed p-16 text-center bg-card/50">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-6">
                <Search className="h-10 w-10 text-primary/60" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Search Employee Reports</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Search by employee ID, name, or use filters to find work reports
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Try:</span>
                <code className="px-2.5 py-1 bg-muted rounded-lg font-mono">EMP001</code>
                <span>or</span>
                <code className="px-2.5 py-1 bg-muted rounded-lg font-mono">John Doe</code>
                <span>or select a department</span>
              </div>
            </div>
          )}
        </div>

          {/* Calendar Sidebar - Only for employees */}
          {session?.role === 'employee' && (
            <div className="lg:sticky lg:top-20 h-fit">
              <WorkReportCalendar 
                reports={allReports.length > 0 ? allReports : reports} 
                holidays={holidays}
                onDateClick={(date) => {
                  const report = (allReports.length > 0 ? allReports : reports).find(r => r.date === date);
                  if (report) {
                    setExpandedReportId(report.id);
                    document.getElementById(`report-${report.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
