'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Loader2, Search, Users, Calendar, Filter, Shield, UserX, CheckCircle2, Building2, UserCheck, AlertCircle, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkReport, SafeEmployee, SessionUser, Department } from '@/types';
import { getISTDateRangeFromDays, getISTTodayDateString, getFullDateIST, getShortDayIST, getShortDateIST, convertUTCToISTDate, getISTTodayRange } from '@/lib/date';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Tooltip } from 'recharts';

export default function ManagersDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamEmployees, setTeamEmployees] = useState<SafeEmployee[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [markingAbsent, setMarkingAbsent] = useState<string | null>(null);
  const [absentDate, setAbsentDate] = useState(getISTTodayDateString());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'working' | 'leave'>('all');
  const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());
  const [reportStatuses, setReportStatuses] = useState<Record<string, { status: string | null; exists: boolean }>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [managerDepartments, setManagerDepartments] = useState<Department[]>([]);
  const [departmentColors, setDepartmentColors] = useState<Map<string, { solid: string; gradient: string; border: string; text: string }>>(new Map());
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Use IST for date range (default to last 7 days for managers)
  const [dateRange, setDateRange] = useState(getISTDateRangeFromDays(7));

  // Glassmorphic design - Black and white theme
  const getDepartmentColor = (departmentName: string, index: number) => {
    // All departments use the same glassmorphic black/white design
    // Visual distinction comes from subtle variations in opacity and borders
    const variations = [
      { solid: 'bg-card/80 backdrop-blur-sm', gradient: 'from-card/80 to-card/50', border: 'border-border/50', text: 'text-foreground', accent: 'bg-foreground/5' },
      { solid: 'bg-card/70 backdrop-blur-sm', gradient: 'from-card/70 to-card/40', border: 'border-border/60', text: 'text-foreground', accent: 'bg-foreground/10' },
      { solid: 'bg-card/90 backdrop-blur-sm', gradient: 'from-card/90 to-card/60', border: 'border-border/40', text: 'text-foreground', accent: 'bg-foreground/5' },
      { solid: 'bg-card/75 backdrop-blur-sm', gradient: 'from-card/75 to-card/45', border: 'border-border/55', text: 'text-foreground', accent: 'bg-foreground/8' },
      { solid: 'bg-card/85 backdrop-blur-sm', gradient: 'from-card/85 to-card/55', border: 'border-border/45', text: 'text-foreground', accent: 'bg-foreground/6' },
      { solid: 'bg-card/80 backdrop-blur-sm', gradient: 'from-card/80 to-card/50', border: 'border-border/50', text: 'text-foreground', accent: 'bg-foreground/5' },
      { solid: 'bg-card/70 backdrop-blur-sm', gradient: 'from-card/70 to-card/40', border: 'border-border/60', text: 'text-foreground', accent: 'bg-foreground/10' },
      { solid: 'bg-card/90 backdrop-blur-sm', gradient: 'from-card/90 to-card/60', border: 'border-border/40', text: 'text-foreground', accent: 'bg-foreground/5' },
    ];
    return variations[index % variations.length];
  };

  // Initialize department colors
  useEffect(() => {
    if (managerDepartments.length > 0) {
      const colorMap = new Map<string, { solid: string; gradient: string; border: string; text: string }>();
      managerDepartments.forEach((dept, index) => {
        colorMap.set(dept.name, getDepartmentColor(dept.name, index));
      });
      setDepartmentColors(colorMap);
    }
  }, [managerDepartments]);

  useEffect(() => {
    fetchSession();
    fetchManagerDepartments();
  }, []);

  useEffect(() => {
    if (dateRange.start && dateRange.end && managerDepartments.length > 0) {
      fetchReports();
    }
  }, [dateRange, managerDepartments]);

  useEffect(() => {
    if (dialogOpen) {
      fetchTeamEmployees();
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (teamEmployees.length > 0 && absentDate && dialogOpen) {
      fetchReportStatuses();
    }
  }, [teamEmployees, absentDate, dialogOpen]);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
    }
  };

  const fetchManagerDepartments = async () => {
    try {
      const response = await fetch('/api/managers/departments');
      const data = await response.json();
      if (data.success && data.data) {
        setManagerDepartments(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch manager departments:', error);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/work-reports?startDate=${dateRange.start}&endDate=${dateRange.end}`);
      const data = await response.json();
      if (data.success) {
        // Filter reports by manager's departments
        const deptNames = managerDepartments.map(d => d.name);
        const filtered = (data.data.reports || []).filter((r: WorkReport) =>
          deptNames.includes(r.department)
        );
        setReports(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamEmployees = async () => {
    setLoadingTeam(true);
    try {
      const response = await fetch('/api/managers/team');
      const data = await response.json();
      if (data.success) setTeamEmployees(data.data || []);
    } catch (error) {
      console.error('Failed to fetch team employees:', error);
    } finally {
      setLoadingTeam(false);
    }
  };

  const fetchReportStatuses = async () => {
    if (teamEmployees.length === 0 || !absentDate) return;

    setLoadingStatuses(true);
    try {
      const employeeIds = teamEmployees.map(emp => emp.employeeId).join(',');
      const response = await fetch(`/api/work-reports/status?employeeIds=${encodeURIComponent(employeeIds)}&date=${absentDate}`);
      const data = await response.json();
      if (data.success) {
        setReportStatuses(data.data || {});
      }
    } catch (error) {
      console.error('Failed to fetch report statuses:', error);
    } finally {
      setLoadingStatuses(false);
    }
  };

  const handleMarkAbsent = async (employeeId: string) => {
    if (!absentDate) {
      toast.error('Please select a date');
      return;
    }

    setMarkingAbsent(employeeId);
    try {
      const response = await fetch('/api/work-reports/mark-absent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, date: absentDate }),
      });

      const data = await response.json();
      if (data.success) {
        const employee = teamEmployees.find(emp => emp.employeeId === employeeId);
        toast.success(`${employee?.name || 'Employee'} marked as absent (leave) for ${getFullDateIST(absentDate)}`);
        setRecentlyMarked(prev => new Set(prev).add(employeeId));
        // Refresh report statuses
        await fetchReportStatuses();
        setTimeout(() => {
          setRecentlyMarked(prev => {
            const newSet = new Set(prev);
            newSet.delete(employeeId);
            return newSet;
          });
        }, 3000);
        fetchReports(); // Refresh reports
      } else {
        toast.error(data.error || 'Failed to mark employee as absent');
      }
    } catch (error) {
      console.error('Failed to mark absent:', error);
      toast.error('Failed to mark employee as absent');
    } finally {
      setMarkingAbsent(null);
    }
  };

  const handleMarkPresent = async (employeeId: string) => {
    if (!absentDate) {
      toast.error('Please select a date');
      return;
    }

    setMarkingAbsent(employeeId);
    try {
      const response = await fetch('/api/work-reports/mark-present', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, date: absentDate }),
      });

      const data = await response.json();
      if (data.success) {
        const employee = teamEmployees.find(emp => emp.employeeId === employeeId);
        toast.success(`${employee?.name || 'Employee'} marked as present (working) for ${getFullDateIST(absentDate)}`);
        setRecentlyMarked(prev => new Set(prev).add(employeeId));
        // Refresh report statuses
        await fetchReportStatuses();
        setTimeout(() => {
          setRecentlyMarked(prev => {
            const newSet = new Set(prev);
            newSet.delete(employeeId);
            return newSet;
          });
        }, 3000);
        fetchReports(); // Refresh reports
      } else {
        toast.error(data.error || 'Failed to mark employee as present');
      }
    } catch (error) {
      console.error('Failed to mark present:', error);
      toast.error('Failed to mark employee as present');
    } finally {
      setMarkingAbsent(null);
    }
  };

  const isLateSubmission = (report: WorkReport) => {
    try {
      const submissionDate = convertUTCToISTDate(report.createdAt);
      // A report is late only if submitted on a day AFTER the report date
      // Same day submissions (even at 11:59 PM IST) should NOT be marked as late
      // Compare dates as strings (YYYY-MM-DD format)
      const isLate = report.date < submissionDate;
      return isLate;
    } catch (error) {
      // If date conversion fails, don't mark as late (fail-safe)
      console.error('Error checking late submission:', error);
      return false;
    }
  };

  const toggleExpand = (reportId: number) => {
    setExpandedReportId(expandedReportId === reportId ? null : reportId);
  };

  // Filter reports based on search, status, and department
  const getFilteredReports = () => {
    let filtered = reports;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.workReport || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Department filter
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(r => r.department === selectedDepartment);
    }

    return filtered;
  };

  // Calculate chart data from filtered reports
  const chartData = useMemo(() => {
    const filtered = getFilteredReports();

    // 1. Employee Bar Data (For Single Dept Manager)
    // Structure: { name: employeeName, working: count, leave: count }
    const employeeStats: Record<string, { name: string; working: number; leave: number }> = {};

    // 2. Department Line Data (For Multi Dept Manager - All Depts)
    // Structure: { date: displayDate, DeptA: count, DeptB: count, ..., _sortKey: isoDate }
    const statsByIsoDate: Record<string, { date: string; _sortKey: string; [key: string]: string | number }> = {};

    // 3. Employee Line Data (For Multi Dept Manager - Filtered Dept)
    // Structure: { date: displayDate, EmpA: count, EmpB: count, ..., _sortKey: isoDate }
    const empStatsByIsoDate: Record<string, { date: string; _sortKey: string; [key: string]: string | number }> = {};
    const allEmpNames = new Set<string>();

    // Single loop to calculate all stats efficiently
    filtered.forEach(report => {
      // Bar Data Logic - Employee stats for single department view
      if (!employeeStats[report.employeeId]) {
        employeeStats[report.employeeId] = {
          name: report.name,
          working: 0,
          leave: 0
        };
      }
      if (report.status === 'working') employeeStats[report.employeeId].working++;
      if (report.status === 'leave') employeeStats[report.employeeId].leave++;

      // Line Data Logic - Use ISO date for proper sorting
      const isoDate = report.date; // YYYY-MM-DD format
      const displayDate = getShortDateIST(report.date);

      // Department Line Data
      if (!statsByIsoDate[isoDate]) {
        statsByIsoDate[isoDate] = { date: displayDate, _sortKey: isoDate };
      }
      const deptValue = statsByIsoDate[isoDate][report.department];
      statsByIsoDate[isoDate][report.department] = (typeof deptValue === 'number' ? deptValue : 0) + 1;

      // Employee Line Data
      if (!empStatsByIsoDate[isoDate]) {
        empStatsByIsoDate[isoDate] = { date: displayDate, _sortKey: isoDate };
      }
      const empValue = empStatsByIsoDate[isoDate][report.name];
      empStatsByIsoDate[isoDate][report.name] = (typeof empValue === 'number' ? empValue : 0) + 1;
      allEmpNames.add(report.name);
    });

    const employeeBarData = Object.values(employeeStats);

    // Sort line data by ISO date for correct chronological order
    const departmentLineData = Object.values(statsByIsoDate)
      .sort((a, b) => a._sortKey.localeCompare(b._sortKey));

    const employeeLineData = Object.values(empStatsByIsoDate)
      .sort((a, b) => a._sortKey.localeCompare(b._sortKey));

    return {
      employeeBarData,
      departmentLineData,
      employeeLineData,
      allEmpNames: Array.from(allEmpNames)
    };
  }, [reports, searchTerm, statusFilter, selectedDepartment]);

  // Group reports by department for Scrum board columns
  const groupReportsByDepartment = (reports: WorkReport[]) => {
    const grouped: Record<string, WorkReport[]> = {};
    managerDepartments.forEach(dept => {
      grouped[dept.name] = reports.filter(r => r.department === dept.name);
    });
    return grouped;
  };

  // WorkReportCard Component
  const WorkReportCard = ({ report }: { report: WorkReport }) => {
    return (
      <div
        onClick={() => toggleExpand(report.id)}
        className={`group relative p-3 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer mb-2 ${expandedReportId === report.id ? 'ring-2 ring-primary' : ''
          }`}
      >
        <div className="flex items-start gap-2">
          {/* Employee Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {report.name?.charAt(0) || 'E'}
          </div>

          <div className="flex-1 min-w-0">
            {/* Employee Name & ID */}
            <div className="mb-2">
              <p className="text-sm font-semibold truncate">{report.name}</p>
              <p className="text-xs text-muted-foreground truncate font-mono">{report.employeeId}</p>
            </div>

            {/* Date */}
            <div className="mb-2">
              <p className="text-xs text-muted-foreground">
                {getShortDayIST(report.date)} {getShortDateIST(report.date)}
              </p>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.status === 'working'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                }`}>
                {report.status === 'working' ? 'Working' : 'Leave'}
              </span>

              {/* On Duty Badge */}
              {report.onDuty && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                  <Shield className="h-3 w-3" />
                  On Duty
                </span>
              )}

              {/* Halfday Badge */}
              {report.halfday && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400">
                  <Calendar className="h-3 w-3" />
                  Halfday
                </span>
              )}

              {/* Late Submission Badge */}
              {isLateSubmission(report) && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
                  <AlertCircle className="h-3 w-3" />
                  Late
                </span>
              )}
            </div>

            {/* Work Report Preview */}
            {report.workReport && expandedReportId !== report.id && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {report.workReport}
              </p>
            )}

            {/* Expanded Content */}
            {expandedReportId === report.id && report.workReport && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{report.workReport}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Filter employees for the mark absent modal
  const filteredEmployees = teamEmployees.filter(emp => {
    const matchesSearch = employeeSearch === '' ||
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.department.toLowerCase().includes(employeeSearch.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || emp.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  // Get unique departments for filter
  const departments = Array.from(new Set(teamEmployees.map(emp => emp.department))).sort();

  const filteredReports = getFilteredReports();
  const reportsByDepartment = groupReportsByDepartment(filteredReports);

  return (
    <div className="min-h-screen pt-16 bg-muted/20">
      <div className="container py-6 px-4 md:px-6">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Managers Dashboard</h1>
              <p className="text-sm text-muted-foreground">Scrum board view for team work reports</p>
            </div>
            {user?.pageAccess?.mark_attendance && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserX className="h-4 w-4" />
                    Mark Attendance
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0">
                  {/* Header with gradient */}
                  <div className="relative px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                        <UserX className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <DialogTitle className="text-xl font-bold">Mark Employee as Absent</DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                          Select an employee and date to mark them as absent. You can only mark employees in your assigned departments.
                        </DialogDescription>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Date Selection Card */}
                    <div className="relative p-4 rounded-xl bg-gradient-to-br from-card/80 to-card/50 border border-border/50 backdrop-blur-sm shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <label className="text-sm font-semibold">Select Date</label>
                      </div>
                      <Input
                        type="date"
                        value={absentDate}
                        onChange={(e) => setAbsentDate(e.target.value)}
                        max={getISTTodayDateString()}
                        className="w-full h-11 bg-background/50 border-border/50 focus:border-primary/50"
                      />
                      {absentDate && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {getFullDateIST(absentDate)}
                        </p>
                      )}
                    </div>

                    {/* Stats Card */}
                    <div className="relative p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{filteredEmployees.length}</p>
                            <p className="text-xs text-muted-foreground">
                              {filteredEmployees.length === 1 ? 'Employee' : 'Employees'} Available
                            </p>
                          </div>
                        </div>
                        {teamEmployees.length > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-muted-foreground">Total</p>
                            <p className="text-lg font-bold">{teamEmployees.length}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Search and Filter */}
                    {teamEmployees.length > 0 && (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, ID, or department..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="pl-11 h-11 bg-background/50 border-border/50 focus:border-primary/50"
                          />
                        </div>
                        {departments.length > 1 && (
                          <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <select
                              value={selectedDepartment}
                              onChange={(e) => setSelectedDepartment(e.target.value)}
                              className="flex h-11 w-full rounded-lg border border-border/50 bg-background/50 px-4 pl-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 appearance-none cursor-pointer"
                            >
                              <option value="all">All Departments</option>
                              {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Employee List */}
                    {loadingTeam ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 rounded-full border-4 border-muted" />
                          <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                        </div>
                        <p className="text-sm text-muted-foreground">Loading employees...</p>
                      </div>
                    ) : teamEmployees.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                          <Users className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold mb-1">No employees found</p>
                          <p className="text-xs text-muted-foreground">
                            No employees are assigned to your departments yet.
                          </p>
                        </div>
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                          <Search className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold mb-1">No employees match your search</p>
                          <p className="text-xs text-muted-foreground">
                            Try adjusting your search or filter criteria.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                        {filteredEmployees.map((employee) => {
                          const isMarking = markingAbsent === employee.employeeId;
                          const isRecentlyMarked = recentlyMarked.has(employee.employeeId);
                          const reportStatus = reportStatuses[employee.employeeId];
                          const isMarkedAbsentByOperations = reportStatus?.status === 'leave';
                          const isMarkedPresent = reportStatus?.status === 'working';
                          return (
                            <div
                              key={employee.employeeId}
                              className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${isRecentlyMarked
                                ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-2 border-emerald-500/30 shadow-sm'
                                : 'bg-gradient-to-br from-card/80 to-card/50 border border-border/50 hover:border-primary/30 hover:shadow-md'
                                }`}
                            >
                              {/* Gradient accent bar */}
                              {isRecentlyMarked && (
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
                              )}

                              <div className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${isRecentlyMarked
                                      ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white'
                                      : 'bg-gradient-to-br from-primary/10 to-primary/5 text-primary'
                                      }`}>
                                      {employee.name.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-sm truncate">{employee.name}</h4>
                                        {isRecentlyMarked && (
                                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 font-mono">
                                          {employee.employeeId}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50">
                                          <Building2 className="h-3 w-3" />
                                          {employee.department}
                                        </span>
                                        {isMarkedAbsentByOperations && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                                            Operations marked absent
                                          </span>
                                        )}
                                        {isMarkedPresent && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                                            Present
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-2 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      onClick={() => handleMarkAbsent(employee.employeeId)}
                                      disabled={isMarking || !absentDate || isMarkedAbsentByOperations}
                                      className={`gap-2 transition-all ${isRecentlyMarked && !isMarkedPresent
                                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white'
                                        : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
                                        }`}
                                      title={isMarkedAbsentByOperations ? "Operations has already marked this employee as absent" : ""}
                                    >
                                      {isMarking ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          <span>Marking...</span>
                                        </>
                                      ) : isRecentlyMarked && !isMarkedPresent ? (
                                        <>
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          <span>Marked</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-3.5 w-3.5" />
                                          <span>Mark Absent</span>
                                        </>
                                      )}
                                    </Button>
                                    {(isMarkedAbsentByOperations || isMarkedPresent) && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleMarkPresent(employee.employeeId)}
                                        disabled={isMarking || !absentDate}
                                        variant="outline"
                                        className="gap-2"
                                      >
                                        {isMarking ? (
                                          <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            <span>Marking...</span>
                                          </>
                                        ) : (
                                          <>
                                            <UserCheck className="h-3.5 w-3.5" />
                                            <span>Mark Present</span>
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Filters and Charts Panel */}
          {showFilters && (
            <div className="mb-6 border rounded-lg bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters & Analytics
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-12 gap-4">
                  {/* Filters Section - 6 columns */}
                  <div className="col-span-12 lg:col-span-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search reports..."
                          className="pl-9"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>

                      {/* Date Range Start */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                        <Input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                          className="w-full"
                        />
                      </div>

                      {/* Date Range End */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                        <Input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                          className="w-full"
                        />
                      </div>

                      {/* Status Filter */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'working' | 'leave')}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="all">All Status</option>
                          <option value="working">Working</option>
                          <option value="leave">Leave</option>
                        </select>
                      </div>

                      {/* Department Filter */}
                      {managerDepartments.length > 1 && (
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Department</label>
                          <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="all">All Departments</option>
                            {managerDepartments.map(dept => (
                              <option key={dept.id} value={dept.name}>{dept.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Quick Date Range Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(getISTTodayRange())}
                        className="text-xs"
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(getISTDateRangeFromDays(7))}
                        className="text-xs"
                      >
                        Last 7 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(getISTDateRangeFromDays(14))}
                        className="text-xs"
                      >
                        Last 14 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(getISTDateRangeFromDays(30))}
                        className="text-xs"
                      >
                        Last 30 Days
                      </Button>
                      {(searchTerm || statusFilter !== 'all' || selectedDepartment !== 'all') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm('');
                            setStatusFilter('all');
                            setSelectedDepartment('all');
                          }}
                          className="text-xs"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Charts Section - 6 columns */}
                  <div className="col-span-12 lg:col-span-6 space-y-4">
                    <div className="border rounded-lg p-4 bg-muted/30 h-full">
                      <h4 className="text-sm font-semibold mb-3 text-center">
                        {managerDepartments.length === 1
                          ? "Employee Attendance Overview"
                          : selectedDepartment === 'all'
                            ? "Department Trends"
                            : "Employee Trends (Filtered)"}
                      </h4>
                      <div className="h-[250px] w-full">
                        {managerDepartments.length === 1 ? (
                          <ChartContainer
                            config={{
                              working: { label: "Working", color: "#22c55e" },
                              leave: { label: "Leave", color: "#f59e0b" },
                            }}
                            className="h-full w-full !aspect-auto"
                          >
                            <BarChart data={chartData.employeeBarData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis dataKey="name" fontSize={12} interval={0} angle={-45} textAnchor="end" height={60} />
                              <YAxis />
                              <Tooltip content={<ChartTooltipContent />} />
                              <Legend />
                              <Bar dataKey="working" name="Working" fill="#22c55e" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="leave" name="Leave" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ChartContainer>
                        ) : selectedDepartment === 'all' ? (
                          <ChartContainer
                            config={Object.fromEntries(
                              managerDepartments.map((dept, index) => [
                                dept.name,
                                {
                                  label: dept.name,
                                  color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5],
                                },
                              ])
                            )}
                            className="h-full w-full !aspect-auto"
                          >
                            <LineChart data={chartData.departmentLineData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis dataKey="date" fontSize={12} />
                              <YAxis />
                              <Tooltip content={<ChartTooltipContent />} />
                              <Legend />
                              {managerDepartments.map((dept, index) => (
                                <Line
                                  key={dept.name}
                                  type="monotone"
                                  dataKey={dept.name}
                                  stroke={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5]}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              ))}
                            </LineChart>
                          </ChartContainer>
                        ) : (
                          <ChartContainer
                            config={Object.fromEntries(
                              chartData.allEmpNames.map((empName, index) => [
                                empName,
                                {
                                  label: empName,
                                  color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'][index % 6],
                                },
                              ])
                            )}
                            className="h-full w-full !aspect-auto"
                          >
                            <LineChart data={chartData.employeeLineData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis dataKey="date" fontSize={12} />
                              <YAxis />
                              <Tooltip content={<ChartTooltipContent />} />
                              <Legend />
                              {/* We need to dynamically generate lines for employees present in the data */}
                              {chartData.allEmpNames.map((empName, index) => (
                                <Line
                                  key={empName}
                                  type="monotone"
                                  dataKey={empName}
                                  stroke={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'][index % 6]}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              ))}
                            </LineChart>
                          </ChartContainer>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!showFilters && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(true)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Show Filters
              </Button>
            </div>
          )}

          {/* Scrum Board */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : managerDepartments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium">No departments assigned</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please contact an administrator to assign departments to your account.
              </p>
            </div>
          ) : managerDepartments.length === 1 ? (
            // Single Department: Full-width optimized layout
            <div className="w-full max-w-6xl mx-auto">
              {managerDepartments.map(dept => {
                const colorScheme = departmentColors.get(dept.name);
                const deptReports = reportsByDepartment[dept.name] || [];

                return (
                  <div
                    key={dept.id}
                    className={`w-full rounded-xl border-2 shadow-lg ${colorScheme?.border || 'border-border'} ${colorScheme?.solid || 'bg-card'}`}
                  >
                    {/* Column Header - Enhanced for single department */}
                    <div className={`p-6 rounded-t-xl border-b-2 ${colorScheme?.border || 'border-border'} ${colorScheme?.gradient
                      ? `bg-gradient-to-br ${colorScheme.gradient}`
                      : colorScheme?.solid || 'bg-muted'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorScheme?.text || 'text-foreground'
                            } bg-background/30`}>
                            <Building2 className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className={`text-xl font-bold ${colorScheme?.text || 'text-foreground'}`}>
                              {dept.name}
                            </h3>
                            <p className={`text-xs ${colorScheme?.text || 'text-muted-foreground'} opacity-80`}>
                              {deptReports.length} {deptReports.length === 1 ? 'report' : 'reports'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${colorScheme?.text || 'text-muted-foreground'
                          } bg-background/60 backdrop-blur-sm`}>
                          {deptReports.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Content - Grid layout for better space utilization */}
                    <div className="p-6">
                      {deptReports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <Building2 className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No reports found</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Work reports will appear here once submitted
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {deptReports.map(report => (
                            <WorkReportCard key={report.id} report={report} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Multiple Departments: Scrum board horizontal layout
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {managerDepartments.map(dept => {
                  const colorScheme = departmentColors.get(dept.name);
                  const deptReports = reportsByDepartment[dept.name] || [];

                  return (
                    <div
                      key={dept.id}
                      className={`flex-shrink-0 w-80 rounded-lg border-2 ${colorScheme?.border || 'border-border'} ${colorScheme?.solid || 'bg-card'}`}
                    >
                      {/* Column Header */}
                      <div className={`p-4 rounded-t-lg border-b-2 ${colorScheme?.border || 'border-border'} ${colorScheme?.gradient
                        ? `bg-gradient-to-b ${colorScheme.gradient}`
                        : colorScheme?.solid || 'bg-muted'
                        }`}>
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold text-sm ${colorScheme?.text || 'text-foreground'}`}>
                            {dept.name}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorScheme?.text || 'text-muted-foreground'
                            } bg-background/50`}>
                            {deptReports.length}
                          </span>
                        </div>
                      </div>

                      {/* Column Content */}
                      <div className="p-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
                        {deptReports.length === 0 ? (
                          <div className="flex items-center justify-center py-8 text-center">
                            <p className="text-xs text-muted-foreground">No reports</p>
                          </div>
                        ) : (
                          deptReports.map(report => (
                            <WorkReportCard key={report.id} report={report} />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
