'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Search,
  Bell,
  CircleHelp,
  Settings,
  Grid3X3,
  FileText,
  Users,
  Activity,
  Shield,
  Plus,
  ChevronLeft,
  ChevronRight,
  Bolt,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Entity, Branch, Department, WorkReport } from '@/types';

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

export default function ManagementDashboardPage() {
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
    return [...employees].sort((a, b) => b.submittedCount - a.submittedCount).slice(0, 3);
  }, [employees]);

  const heatmapDays = useMemo(() => daysArray.slice(0, 14), [daysArray]);

  const velocityBars = useMemo(() => {
    const top = departmentPerformance.slice(0, 6);
    if (top.length === 0) return [20, 28, 36, 44, 52, 48];
    return top.map((d) => Math.max(16, Math.round((d.rate / 100) * 56)));
  }, [departmentPerformance]);

  const getDotClass = (status: EmployeeReportStatus['dailyStatus'][string]) => {
    if (status === 'submitted') return 'bg-emerald-500';
    if (status === 'leave') return 'bg-yellow-500';
    if (status === 'not_submitted') return 'bg-slate-300';
    return 'bg-slate-200';
  };

  const handleOpenReportDialog = useCallback(async (employee: EmployeeReportStatus, date: string) => {
    if (employee.dailyStatus[date] !== 'submitted') return;
    setReportDialogOpen(true);
    setReportDialogLoading(true);
    setReportDialogError('');
    setSelectedReport(null);
    setSelectedReportMeta({ employeeName: employee.name, date });
    try {
      const response = await fetch(`/api/work-reports?employeeId=${encodeURIComponent(employee.employeeId)}`);
      const result = await response.json();
      const report = (result.data?.reports as WorkReport[] | undefined)?.find((r) => r.date === date);
      if (!report) {
        setReportDialogError('No report details found for this date');
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
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center text-destructive">
        {error || 'Unable to load management dashboard'}
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 bg-background overflow-x-hidden">
      <div className="px-3 sm:px-4 md:px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:flex lg:flex-col rounded-md border border-primary/30 bg-primary text-primary-foreground overflow-hidden min-h-[calc(100vh-7.5rem)]">
            <div className="px-5 py-4 border-b border-primary-foreground/10">
              <h2 className="text-2xl font-semibold leading-none">Work Report</h2>
              <p className="text-[11px] mt-1 uppercase tracking-[0.08em] text-primary-foreground/70">Enterprise Analytics</p>
            </div>
            <nav className="px-2 py-3 space-y-1">
              <Link href="/employee-dashboard" className="flex items-center gap-3 rounded-sm bg-primary-foreground/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em]">
                <Grid3X3 className="h-4 w-4" /> Dashboard
              </Link>
              <Link href="/employee-reports" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <FileText className="h-4 w-4" /> Reports
              </Link>
              <Link href="/manage-team" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <Users className="h-4 w-4" /> Team Management
              </Link>
              <Link href="/management-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <Activity className="h-4 w-4" /> Analytics
              </Link>
              <Link href="/admin" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <Shield className="h-4 w-4" /> Admin Portal
              </Link>
            </nav>
          </aside>

          <main className="space-y-4">
            <div className="rounded-md border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-semibold tracking-[-0.01em]">Executive Intelligence</h1>
                  <div className="relative min-w-[260px] hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search departments, employees..."
                      className="pl-9 h-9 bg-muted/30 border-0"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Bell className="h-4 w-4" /></button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><CircleHelp className="h-4 w-4" /></button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Settings className="h-4 w-4" /></button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border bg-card p-4">
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Total Workforce</p>
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
                  <p className="text-sm text-muted-foreground">Real-time submission trends across departments</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Submitted</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />Absent</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Pending</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" />Off</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
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
                            return (
                              <td key={`${emp.employeeId}-${d.dateStr}`} className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReportDialog(emp, d.dateStr)}
                                  className={`inline-flex h-3 w-3 rounded-full ${getDotClass(s)}`}
                                  title={`${d.dateStr} - ${s}`}
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

              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center justify-between">
                <span>Active nodes: {summary.totalEmployees} across {departmentPerformance.length} departments</span>
                <div className="flex items-center gap-1">
                  <button onClick={handlePrevMonth} className="h-7 w-7 rounded-sm border inline-flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="px-2">{String(selectedMonth).padStart(2, '0')}</span>
                  <button onClick={handleNextMonth} className="h-7 w-7 rounded-sm border inline-flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_220px]">
              <div className="rounded-md border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.01em]">Compliance Velocity</h2>
                    <p className="text-sm text-muted-foreground">Trailing 30-day submission momentum</p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Last 6 Months</span>
                </div>
                <div className="h-44 flex items-end gap-2 border-b pb-4">
                  {velocityBars.map((h, idx) => (
                    <div key={idx} className="flex-1 rounded-t-sm bg-primary" style={{ height: `${h * 2}px` }} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Peak Time</p>
                    <p className="font-semibold">09:42 AM</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Avg Delay</p>
                    <p className="font-semibold">14.2 Min</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Entity Sync</p>
                    <p className="font-semibold text-emerald-600">Optimal</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border bg-primary text-primary-foreground p-4 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <Bolt className="h-5 w-5" />
                  <Plus className="h-4 w-4" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Core Health</h3>
                <p className="text-sm text-primary-foreground/80 mb-6">
                  Infrastructure status is nominal. Reporting engines synchronized across all nodes.
                </p>
                <div className="mt-auto pt-4 border-t border-primary-foreground/20">
                  <p className="text-xs uppercase tracking-[0.06em] text-primary-foreground/70">Network Latency</p>
                  <p className="text-4xl font-semibold">42ms</p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
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
    </div>
  );
}
