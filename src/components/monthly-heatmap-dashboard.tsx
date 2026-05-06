'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Entity, Branch, Department, WorkReport } from '@/types';

export type MonthlyHeatmapVariant = 'executive' | 'team';

interface EmployeeReportStatus {
  employeeId: string;
  name: string;
  department: string;
  entityId: number | null;
  branchId: number | null;
  dailyStatus: Record<string, 'submitted' | 'leave' | 'not_submitted' | 'sunday' | 'future'>;
  submittedCount: number;
  workingDaysCount: number;
}

interface MonthlyStatusData {
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function MonthlyHeatmapDashboard({ variant }: { variant: MonthlyHeatmapVariant }) {
  const isTeam = variant === 'team';
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<MonthlyStatusData | null>(null);
  const [error, setError] = useState('');
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDialogLoading, setReportDialogLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [selectedReportMeta, setSelectedReportMeta] = useState<{ employeeName: string; date: string } | null>(null);
  const [reportDialogError, setReportDialogError] = useState('');
  /** When user clicked a leave day but no work_reports row exists */
  const [leaveDayOnly, setLeaveDayOnly] = useState(false);

  const fetchMonthlyStatus = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });
      if (selectedEntity !== 'all') params.append('entityId', selectedEntity);
      if (selectedBranch !== 'all') params.append('branchId', selectedBranch);
      if (selectedDepartment !== 'all') params.append('department', selectedDepartment);
      const response = await fetch(`/api/reports/monthly-status?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setStatusData(result.data);
        setError('');
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedEntity, selectedBranch, selectedDepartment]);

  useEffect(() => {
    fetchMonthlyStatus();
  }, [fetchMonthlyStatus]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  useEffect(() => {
    setSelectedBranch('all');
  }, [selectedEntity]);

  useEffect(() => {
    setSelectedDepartment('all');
  }, [selectedEntity, selectedBranch]);

  const filteredBranches = useMemo(() => {
    if (!statusData) return [];
    if (selectedEntity === 'all') return statusData.branches;
    return statusData.branches.filter((b) => b.entityId === parseInt(selectedEntity));
  }, [statusData, selectedEntity]);

  const filteredDepartments = useMemo(() => {
    if (!statusData) return [];
    if (selectedEntity === 'all') return statusData.departments;
    return statusData.departments.filter((d) => d.entityId === parseInt(selectedEntity) || d.entityId === null);
  }, [statusData, selectedEntity]);

  const employees = useMemo(() => {
    if (!statusData) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return statusData.employees;
    return statusData.employees.filter((emp) =>
      emp.name.toLowerCase().includes(query) ||
      emp.employeeId.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query)
    );
  }, [statusData, searchQuery]);

  const daysArray = useMemo(() => {
    if (!statusData) return [];
    const days: { day: number; dateStr: string }[] = [];
    for (let day = 1; day <= statusData.daysInMonth; day++) {
      days.push({
        day,
        dateStr: `${statusData.year}-${String(statusData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    }
    return days;
  }, [statusData]);

  const summary = useMemo(() => {
    if (!statusData) {
      return { totalEmployees: 0, activeEmployees: 0, workingCycle: 0, compliance: 0 };
    }
    const totalEmployees = statusData.employees.length;
    const activeEmployees = statusData.employees.filter((emp) =>
      Object.values(emp.dailyStatus).some((s) => s === 'submitted' || s === 'leave')
    ).length;

    let expected = 0;
    let completed = 0;
    statusData.employees.forEach((emp) => {
      Object.values(emp.dailyStatus).forEach((s) => {
        if (s === 'future' || s === 'sunday') return;
        expected += 1;
        if (s === 'submitted' || s === 'leave') completed += 1;
      });
    });
    const compliance = expected > 0 ? (completed / expected) * 100 : 0;

    return {
      totalEmployees,
      activeEmployees,
      workingCycle: daysArray.length,
      compliance: Math.round(compliance * 10) / 10,
    };
  }, [statusData, daysArray.length]);

  const departmentPerformance = useMemo(() => {
    if (!statusData) return [];
    const map: Record<string, { submitted: number; expected: number }> = {};
    statusData.employees.forEach((emp) => {
      if (!map[emp.department]) map[emp.department] = { submitted: 0, expected: 0 };
      Object.values(emp.dailyStatus).forEach((s) => {
        if (s === 'future' || s === 'sunday') return;
        map[emp.department].expected += 1;
        if (s === 'submitted' || s === 'leave') map[emp.department].submitted += 1;
      });
    });
    return Object.entries(map)
      .map(([department, stats]) => ({
        department,
        rate: stats.expected ? Math.round((stats.submitted / stats.expected) * 100) : 0,
        submitted: stats.submitted,
        expected: stats.expected,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [statusData]);

  const heatmapEmployees = useMemo(() => {
    return [...employees].sort((a, b) => b.submittedCount - a.submittedCount);
  }, [employees]);

  const heatmapDays = useMemo(() => daysArray, [daysArray]);

  const getDotClass = (status: EmployeeReportStatus['dailyStatus'][string]) => {
    if (status === 'submitted') return 'bg-emerald-500 hover:ring-2 hover:ring-emerald-500/40';
    if (status === 'leave') return 'bg-yellow-500 hover:ring-2 hover:ring-yellow-500/40';
    if (status === 'not_submitted') return 'bg-slate-300';
    return 'bg-slate-200';
  };

  const handleOpenReportDialog = useCallback(async (employee: EmployeeReportStatus, date: string) => {
    const st = employee.dailyStatus[date];
    if (st !== 'submitted' && st !== 'leave') return;

    setReportDialogOpen(true);
    setReportDialogLoading(true);
    setReportDialogError('');
    setSelectedReport(null);
    setLeaveDayOnly(false);
    setSelectedReportMeta({ employeeName: employee.name, date });

    try {
      const response = await fetch(`/api/work-reports?employeeId=${encodeURIComponent(employee.employeeId)}`);
      const result = await response.json();
      const report = (result.data?.reports as WorkReport[] | undefined)?.find((r) => r.date === date);
      if (!report) {
        if (st === 'leave') {
          setLeaveDayOnly(true);
          setReportDialogError('');
        } else {
          setReportDialogError('No report details found for this date');
        }
      } else {
        setSelectedReport(report);
      }
    } catch {
      setReportDialogError('Failed to fetch report details');
    } finally {
      setReportDialogLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-destructive text-sm px-4 text-center">
        {error || (isTeam ? 'Unable to load team reports' : 'Unable to load management dashboard')}
      </div>
    );
  }

  return (
    <>
      <main className="space-y-4">
        <div className="rounded-md border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                  {isTeam ? 'Team Reports' : 'Executive Intelligence'}
                </h1>
                {isTeam && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Monthly overview for employees in departments you manage. Green: submitted; yellow: leave.
                  </p>
                )}
              </div>
              <div className="relative min-w-[200px] sm:min-w-[260px] w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isTeam ? 'Search team members…' : 'Search departments, employees…'}
                  className="pl-9 h-9 bg-muted/30 border-0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle className="h-8 w-8 rounded-sm border border-border text-muted-foreground hover:bg-muted hover:text-foreground" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border bg-card p-4">
            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">
              {isTeam ? 'Team size' : 'Total Workforce'}
            </p>
            <p className="text-4xl font-semibold">{summary.totalEmployees.toLocaleString()}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Active Status</p>
            <p className="text-4xl font-semibold">{summary.activeEmployees.toLocaleString()}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Working Cycle</p>
            <p className="text-4xl font-semibold">{summary.workingCycle}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Compliance Score</p>
            <p className="text-4xl font-semibold">{summary.compliance}%</p>
          </div>
        </div>

        <section className="rounded-md border bg-card p-4">
          <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Reporting Month</p>
              <div className="inline-flex items-center rounded-sm border">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="h-9 w-9 inline-flex items-center justify-center border-r hover:bg-muted/50"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="px-3 text-sm font-medium min-w-[150px] text-center">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="h-9 w-9 inline-flex items-center justify-center border-l hover:bg-muted/50"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Entity</p>
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
                >
                  <option value="all">All Entities</option>
                  {statusData.entities.map((entity) => (
                    <option key={entity.id} value={String(entity.id)}>
                      {entity.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Branch</p>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
                >
                  <option value="all">All Branches</option>
                  {filteredBranches.map((branch) => (
                    <option key={branch.id} value={String(branch.id)}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Department</p>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
                >
                  <option value="all">All Departments</option>
                  {filteredDepartments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-md border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold tracking-[-0.01em]">Department Performance</h2>
            <span className="text-xs uppercase tracking-[0.06em] text-muted-foreground">View Insights</span>
          </div>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            {departmentPerformance.slice(0, 8).map((dept) => {
              const circumference = 2 * Math.PI * 22;
              const dash = circumference - (dept.rate / 100) * circumference;
              return (
                <div key={dept.department} className="rounded-sm border bg-background p-2 text-center">
                  <div className="relative w-14 h-14 mx-auto mb-1">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/40" />
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        fill="none"
                        strokeWidth="4"
                        strokeLinecap="round"
                        stroke="currentColor"
                        className={dept.rate >= 90 ? 'text-emerald-500' : dept.rate >= 80 ? 'text-blue-500' : 'text-amber-500'}
                        strokeDasharray={circumference}
                        strokeDashoffset={dash}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">{dept.rate}%</div>
                  </div>
                  <p className="text-xs font-medium truncate">{dept.department}</p>
                  <p className="text-[10px] text-muted-foreground">{dept.submitted}/{dept.expected} Sub</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">Activity Heatmap</h2>
              <p className="text-sm text-muted-foreground">
                {isTeam
                  ? 'Click a green dot to view the work report, or yellow for leave details.'
                  : 'Real-time submission trends across departments'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Submitted</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Leave</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />Not Submitted</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" />Off</span>
            </div>
          </div>

          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-2 px-2 uppercase tracking-[0.06em]">Employee Identity</th>
                  {heatmapDays.map((d) => (
                    <th key={d.dateStr} className="py-2 px-2">{String(d.day).padStart(2, '0')}</th>
                  ))}
                  <th className="text-right py-2 px-2 uppercase tracking-[0.06em]">Perf</th>
                </tr>
              </thead>
              <tbody>
                {heatmapEmployees.map((emp) => {
                  const nonFuture = heatmapDays.filter((d) => emp.dailyStatus[d.dateStr] !== 'future' && emp.dailyStatus[d.dateStr] !== 'sunday');
                  const done = nonFuture.filter((d) => {
                    const s = emp.dailyStatus[d.dateStr];
                    return s === 'submitted' || s === 'leave';
                  }).length;
                  const perf = nonFuture.length ? Math.round((done / nonFuture.length) * 100) : 0;
                  return (
                    <tr key={emp.employeeId} className="border-b last:border-0">
                      <td className="py-3 px-2">
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {emp.employeeId} • {emp.department}</p>
                      </td>
                      {heatmapDays.map((d) => {
                        const s = emp.dailyStatus[d.dateStr] || 'future';
                        const clickable = s === 'submitted' || s === 'leave';
                        return (
                          <td key={`${emp.employeeId}-${d.dateStr}`} className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => clickable && handleOpenReportDialog(emp, d.dateStr)}
                              disabled={!clickable}
                              className={`inline-flex h-3 w-3 rounded-full ${getDotClass(s)} ${!clickable ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                              title={`${d.dateStr} - ${s}${clickable ? ' (click for details)' : ''}`}
                            />
                          </td>
                        );
                      })}
                      <td className="py-3 px-2 text-right font-semibold">{perf}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>
              {isTeam ? 'Team members' : 'Active nodes'}: {summary.totalEmployees}
              {departmentPerformance.length > 0 && (
                <> across {departmentPerformance.length} {departmentPerformance.length === 1 ? 'department' : 'departments'}</>
              )}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={handlePrevMonth} className="h-7 w-7 rounded-sm border inline-flex items-center justify-center" aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2">{String(selectedMonth).padStart(2, '0')}</span>
              <button type="button" onClick={handleNextMonth} className="h-7 w-7 rounded-sm border inline-flex items-center justify-center" aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={reportDialogOpen} onOpenChange={(open) => {
        setReportDialogOpen(open);
        if (!open) {
          setLeaveDayOnly(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Work Report Details</DialogTitle>
            <DialogDescription>
              {selectedReportMeta ? `${selectedReportMeta.employeeName} • ${selectedReportMeta.date}` : 'Report'}
            </DialogDescription>
          </DialogHeader>
          {reportDialogLoading ? (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : reportDialogError ? (
            <p className="text-sm text-destructive">{reportDialogError}</p>
          ) : leaveDayOnly && selectedReportMeta ? (
            <p className="text-sm text-muted-foreground">
              This day is recorded as <span className="font-medium text-foreground">leave</span>. No separate report text was found in the system.
            </p>
          ) : selectedReport ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Employee ID</span><span className="font-medium">{selectedReport.employeeId}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{selectedReport.status}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Department</span><span className="font-medium">{selectedReport.department}</span></div>
              <div className="pt-2 border-t">
                <p className="text-muted-foreground mb-1">Work Report</p>
                <p className="whitespace-pre-wrap">{selectedReport.workReport || 'No details provided'}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
