'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Users, Calendar, Briefcase, Coffee, ChevronLeft, ChevronRight, Filter, X, TrendingUp, Building2, Check, Clock, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { logger } from '@/lib/logger';
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
}

interface AnalyticsData {
  summary: {
    totalReports: number;
    workingDays: number;
    leaveDays: number;
    uniqueEmployees: number;
  };
  departmentStats: Array<{
    department: string;
    working: number;
    leave: number;
    total: number;
  }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ManagementDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [statusData, setStatusData] = useState<MonthlyStatusData | null>(null);
  const [error, setError] = useState('');

  // Filter states
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [cardStartDate, setCardStartDate] = useState('');
  const [cardEndDate, setCardEndDate] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDialogLoading, setReportDialogLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [selectedReportMeta, setSelectedReportMeta] = useState<{ employeeName: string; date: string } | null>(null);
  const [reportDialogError, setReportDialogError] = useState('');

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics?days=30');
      const result = await response.json();
      if (result.success) setAnalyticsData(result.data);
    } catch (error) {
      logger.error('Failed to load analytics', error);
    }
  };

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
        setError(result.error || 'Failed to fetch status');
      }
    } catch {
      setError('Failed to load monthly status');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedEntity, selectedBranch, selectedDepartment]);

  useEffect(() => {
    fetchAnalytics();
    // Set current date string on client mount to avoid hydration mismatch
    setCurrentDateStr(new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);

  useEffect(() => {
    fetchMonthlyStatus();
  }, [fetchMonthlyStatus]);

  useEffect(() => {
    const today = new Date();
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;
    const defaultDate = isCurrentMonth
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    setCardStartDate(defaultDate);
    setCardEndDate(defaultDate);
  }, [selectedYear, selectedMonth]);

  // Refresh data when window regains focus (in case holidays were updated in another tab)
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if we have data loaded (avoid unnecessary calls on initial load)
      if (statusData) {
        fetchMonthlyStatus();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [statusData, fetchMonthlyStatus]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleClearFilters = () => {
    setSelectedEntity('all');
    setSelectedBranch('all');
    setSelectedDepartment('all');
  };

  // Filter branches by selected entity
  const filteredBranches = useMemo(() => {
    if (!statusData) return [];
    if (selectedEntity === 'all') return statusData.branches;
    return statusData.branches.filter(b => b.entityId === parseInt(selectedEntity));
  }, [statusData, selectedEntity]);

  // Filter departments by selected entity
  const filteredDepartments = useMemo(() => {
    if (!statusData) return [];
    if (selectedEntity === 'all') return statusData.departments;
    return statusData.departments.filter(d => d.entityId === parseInt(selectedEntity) || d.entityId === null);
  }, [statusData, selectedEntity]);

  // Generate days array for the table header
  const daysArray = useMemo(() => {
    if (!statusData) return [];
    const days: { day: number; dateStr: string; isSunday: boolean }[] = [];
    for (let day = 1; day <= statusData.daysInMonth; day++) {
      const dateStr = `${statusData.year}-${String(statusData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(statusData.year, statusData.month - 1, day);
      days.push({
        day,
        dateStr,
        isSunday: date.getDay() === 0,
      });
    }
    return days;
  }, [statusData]);

  // Create a stable reference to employees array to ensure all three tables stay in sync
  const employeesList = useMemo(() => {
    if (!statusData) return [];
    return statusData.employees;
  }, [statusData]);

  // Calculate department stats from monthly status data
  const monthlyDepartmentStats = useMemo(() => {
    if (!statusData) return [];

    const [rangeStart, rangeEnd] = cardStartDate && cardEndDate
      ? [cardStartDate, cardEndDate]
      : [null, null];

    const deptMap: Record<string, { working: number; leave: number; missing: number; totalExpected: number }> = {};

    statusData.employees.forEach(employee => {
      if (!deptMap[employee.department]) {
        deptMap[employee.department] = { working: 0, leave: 0, missing: 0, totalExpected: 0 };
      }

      Object.entries(employee.dailyStatus).forEach(([date, dayStatus]) => {
        if (rangeStart && rangeEnd && (date < rangeStart || date > rangeEnd)) return;
        if (dayStatus === 'future' || dayStatus === 'sunday') return;

        deptMap[employee.department].totalExpected += 1;

        if (dayStatus === 'submitted') {
          deptMap[employee.department].working += 1;
        } else if (dayStatus === 'leave') {
          deptMap[employee.department].leave += 1;
        } else if (dayStatus === 'not_submitted') {
          deptMap[employee.department].missing += 1;
        }
      });
    });

    return Object.entries(deptMap)
      .map(([department, stats]) => ({ department, ...stats }))
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [statusData, cardStartDate, cardEndDate]);

  const handleOpenReportDialog = useCallback(async (employee: EmployeeReportStatus, date: string) => {
    setReportDialogOpen(true);
    setReportDialogLoading(true);
    setReportDialogError('');
    setSelectedReport(null);
    setSelectedReportMeta({ employeeName: employee.name, date });

    try {
      const response = await fetch(`/api/work-reports?employeeId=${encodeURIComponent(employee.employeeId)}`);
      const result = await response.json();

      if (!result.success || !result.data?.reports) {
        setReportDialogError(result.error || 'Unable to fetch report details');
        return;
      }

      const report = (result.data.reports as WorkReport[]).find(r => r.date === date);
      if (!report) {
        setReportDialogError('No report details found for this date');
        return;
      }

      setSelectedReport(report);
    } catch {
      setReportDialogError('Failed to fetch report details');
    } finally {
      setReportDialogLoading(false);
    }
  }, []);

  // Get department tag color
  const getDepartmentTagColor = (department: string) => {
    const deptLower = department.toLowerCase();
    if (deptLower.includes('account')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    if (deptLower.includes('admin')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    if (deptLower.includes('board')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
    if (deptLower.includes('call')) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    if (deptLower.includes('digital marketing') || deptLower === 'digital marketing') return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200 dark:border-pink-800';
    if (deptLower.includes('social media') || deptLower === 'social media') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800';
    if (deptLower.includes('erp') || deptLower === 'erp') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
    if (deptLower.includes('it') || deptLower === 'it') return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800';
    if (deptLower.includes('graphics') || deptLower === 'graphics') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
    if (deptLower.includes('website') || deptLower === 'website' || deptLower.includes('websites')) return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800';
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
  };

  // Get employee initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusCell = (
    employee: EmployeeReportStatus,
    dateStr: string,
    status: 'submitted' | 'leave' | 'not_submitted' | 'sunday' | 'future'
  ) => {
    switch (status) {
      case 'submitted':
        return (
          <button
            type="button"
            onClick={() => handleOpenReportDialog(employee, dateStr)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center hover:bg-emerald-500/10 transition-colors"
            title="Submitted (click to view report)"
          >
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
          </button>
        );
      case 'leave':
        return (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center" title="Leave">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 rotate-[-90deg]" />
          </div>
        );
      case 'not_submitted':
        return (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center" title="Missing">
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
          </div>
        );
      case 'sunday':
        return (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center" title="Holiday">
            <Building className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
          </div>
        );
      case 'future':
        return <div className="w-7 h-7 sm:w-8 sm:h-8" />;
    }
  };

  const hasActiveFilters = selectedEntity !== 'all' || selectedBranch !== 'all' || selectedDepartment !== 'all';

  // Calculate compliance rate
  const complianceRate = analyticsData 
    ? Math.round((analyticsData.summary.workingDays / (analyticsData.summary.workingDays + analyticsData.summary.leaveDays || 1)) * 100)
    : 0;

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container py-8 px-4 md:px-6">
        <div className="max-w-full mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Management Dashboard</h1>
              <p className="text-muted-foreground">Work report submission overview • Last 30 days</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{currentDateStr}</span>
            </div>
          </div>

          {/* Stats Cards */}
          {analyticsData && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analyticsData.summary.totalReports}</p>
                    <p className="text-xs text-muted-foreground">Total Reports</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10">
                    <Briefcase className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{analyticsData.summary.workingDays}</p>
                    <p className="text-xs text-muted-foreground">Working Days</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/10">
                    <Coffee className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{analyticsData.summary.leaveDays}</p>
                    <p className="text-xs text-muted-foreground">Leave Days</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{analyticsData.summary.uniqueEmployees}</p>
                    <p className="text-xs text-muted-foreground">Active Employees</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card border rounded-xl p-5 shadow-sm col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-violet-500/10">
                    <TrendingUp className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-violet-600">{complianceRate}%</p>
                    <p className="text-xs text-muted-foreground">Work Rate</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Department Stats */}
          {monthlyDepartmentStats.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Department Overview
                </h3>
                <span className="text-xs text-muted-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Card Date Range:</span>
                <Input
                  type="date"
                  value={cardStartDate}
                  onChange={(e) => setCardStartDate(e.target.value)}
                  className="h-8 w-40 text-xs"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={cardEndDate}
                  onChange={(e) => setCardEndDate(e.target.value)}
                  className="h-8 w-40 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {monthlyDepartmentStats.map((dept) => {
                  const rate = dept.totalExpected > 0 ? Math.round(((dept.working + dept.leave) / dept.totalExpected) * 100) : 0;
                  const circumference = 2 * Math.PI * 20;
                  const strokeDashoffset = circumference - (rate / 100) * circumference;
                  const isActive = selectedDepartment === dept.department;
                  
                  return (
                    <button 
                      key={dept.department} 
                      onClick={() => setSelectedDepartment(dept.department)}
                      className={`bg-card border rounded-xl p-4 hover:shadow-md transition-all hover:border-primary/20 text-left ${isActive ? 'ring-2 ring-primary/40 border-primary/30' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate" title={dept.department}>
                            {dept.department}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {dept.totalExpected} expected
                          </p>
                        </div>
                        {/* Circular Progress */}
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                            <circle
                              cx="24"
                              cy="24"
                              r="20"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              className="text-muted/30"
                            />
                            <circle
                              cx="24"
                              cy="24"
                              r="20"
                              fill="none"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className={rate >= 80 ? 'text-emerald-500' : rate >= 50 ? 'text-amber-500' : 'text-rose-500'}
                              stroke="currentColor"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-xs font-bold ${rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {rate}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-muted-foreground">Working</span>
                          <span className="font-semibold text-emerald-600">{dept.working}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span className="text-muted-foreground">Leave</span>
                          <span className="font-semibold text-amber-600">{dept.leave}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span className="text-muted-foreground">Missing</span>
                          <span className="font-semibold text-rose-600">{dept.missing}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Status Table */}
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b bg-gradient-to-r from-background to-muted/20">
              <div className="mb-4">
                <h3 className="font-semibold text-lg">Monthly Submission Status</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Daily work report submission tracking</p>
              </div>

              {/* Filters and Date Navigation */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span className="text-xs sm:text-sm font-medium">Filters:</span>
                  </div>

                  <select
                    value={selectedEntity}
                    onChange={(e) => {
                      setSelectedEntity(e.target.value);
                      setSelectedBranch('all');
                      setSelectedDepartment('all');
                    }}
                    className="h-8 sm:h-9 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="all">All Entities</option>
                    {statusData?.entities.map((entity) => (
                      <option key={entity.id} value={entity.id.toString()}>{entity.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="h-8 sm:h-9 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="all">All Branches</option>
                    {filteredBranches.map((branch) => (
                      <option key={branch.id} value={branch.id.toString()}>{branch.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="h-8 sm:h-9 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="all">All Departments</option>
                    {filteredDepartments.map((dept) => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 sm:h-9 text-muted-foreground text-xs sm:text-sm">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* Date Navigation */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[140px] text-center text-sm font-medium px-2">
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t text-xs">
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-muted-foreground">Submitted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-muted-foreground">Missing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 rotate-[-90deg]" />
                  <span className="text-muted-foreground">Leave</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-muted-foreground">Holiday</span>
                </div>
              </div>
            </div>

            {/* Table Content */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading data...</p>
              </div>
            ) : error ? (
              <div className="py-20 text-center text-destructive">{error}</div>
            ) : statusData && employeesList.length > 0 ? (
              <div className="overflow-x-auto -mx-5 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-5 sm:px-0">
                  <div className="overflow-visible">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left py-3 px-3 sm:px-4 font-medium sticky left-0 z-40 bg-muted/50 dark:bg-muted/80 backdrop-blur-sm min-w-[240px] sm:min-w-[280px] border-r border-border/50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                            <span className="hidden sm:inline">Employee</span>
                            <span className="sm:hidden">Emp</span>
                          </th>
                          {daysArray.map(({ day, isSunday }) => (
                            <th 
                              key={day} 
                              className={`py-3 px-1 sm:px-2 font-medium text-center min-w-[36px] sm:min-w-[40px] text-xs sm:text-sm ${isSunday ? 'opacity-50' : ''}`}
                            >
                              {day}
                            </th>
                          ))}
                          <th className="text-center py-3 px-3 sm:px-4 font-medium sticky right-0 z-40 bg-muted/50 dark:bg-muted/80 backdrop-blur-sm min-w-[70px] sm:min-w-[80px] border-l border-border/50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                            Summary
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {employeesList.map((employee, index) => {
                          // Calculate total working days (excluding holidays and future days)
                          const totalWorkingDays = daysArray.filter(d => {
                            const status = employee.dailyStatus[d.dateStr];
                            return status && status !== 'future' && status !== 'sunday';
                          }).length;
                          
                          const isEvenRow = index % 2 === 0;
                          const rowBgClass = isEvenRow ? 'bg-background' : 'bg-muted/10';
                          const stickyBgClass = isEvenRow 
                            ? 'bg-background dark:bg-background' 
                            : 'bg-muted/10 dark:bg-muted/20';
                          
                          return (
                            <tr 
                              key={employee.employeeId} 
                              className={`hover:bg-muted/30 transition-colors ${rowBgClass}`}
                            >
                              {/* Employee Profile Column */}
                              <td className={`py-3 px-3 sm:px-4 sticky left-0 z-30 ${stickyBgClass} backdrop-blur-sm min-w-[240px] sm:min-w-[280px] border-r border-border/50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]`}>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs sm:text-sm">
                                      {getInitials(employee.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-xs sm:text-sm truncate">{employee.name}</p>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate">{employee.employeeId}</p>
                                    <span className={`inline-block mt-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border font-medium ${getDepartmentTagColor(employee.department)}`}>
                                      {employee.department}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              
                              {/* Daily Status Cells */}
                              {daysArray.map(({ dateStr }) => (
                                <td key={dateStr} className={`py-2 sm:py-3 px-1 sm:px-2 text-center align-middle ${rowBgClass}`}>
                                  {getStatusCell(employee, dateStr, employee.dailyStatus[dateStr])}
                                </td>
                              ))}
                              
                              {/* Summary Counter */}
                              <td className={`py-3 px-3 sm:px-4 text-center sticky right-0 z-30 ${stickyBgClass} backdrop-blur-sm min-w-[70px] sm:min-w-[80px] border-l border-border/50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.3)]`}>
                                <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                                  {employee.submittedCount}/{totalWorkingDays || employee.workingDaysCount}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No employees found for the selected filters.</p>
              </div>
            )}

            {/* Footer */}
            {statusData && employeesList.length > 0 && (
              <div className="px-5 py-3 border-t bg-muted/30 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span><strong className="text-foreground">{employeesList.length}</strong> employees</span>
                <span><strong className="text-foreground">{statusData.daysInMonth}</strong> days in month</span>
                <span><strong className="text-foreground">{daysArray.filter(d => !d.isSunday).length}</strong> working days</span>
              </div>
            )}
          </div>
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employee ID</span>
                <span className="font-medium">{selectedReport.employeeId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{selectedReport.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{selectedReport.department}</span>
              </div>
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
