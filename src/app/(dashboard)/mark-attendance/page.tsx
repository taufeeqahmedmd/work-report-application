'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Search, Users, Calendar, Filter, UserX, CheckCircle2, Building2, ChevronDown, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { SafeEmployee, SessionUser } from '@/types';
import { getISTTodayDateString, getFullDateIST } from '@/lib/date';
import { canMarkAttendance } from '@/lib/permissions';

export default function MarkAttendancePage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamEmployees, setTeamEmployees] = useState<SafeEmployee[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [markingAbsent, setMarkingAbsent] = useState<string | null>(null);
  const [absentDate, setAbsentDate] = useState(getISTTodayDateString());
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());
  const [reportStatuses, setReportStatuses] = useState<Record<string, { status: string | null; exists: boolean }>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    if (session?.pageAccess?.mark_attendance) {
      fetchTeamEmployees();
    }
  }, [session]);

  useEffect(() => {
    if (teamEmployees.length > 0 && absentDate) {
      fetchReportStatuses();
    }
  }, [teamEmployees, absentDate]);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data.success) {
        setSession(data.data);
        // Check if user has permission
        if (!canMarkAttendance(data.data)) {
          toast.error('You do not have permission to access this page');
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamEmployees = async () => {
    setLoadingTeam(true);
    try {
      const response = await fetch('/api/managers/team');
      const data = await response.json();
      if (data.success) {
        setTeamEmployees(data.data || []);
      } else {
        toast.error(data.error || 'Failed to fetch employees');
      }
    } catch (error) {
      console.error('Failed to fetch team employees:', error);
      toast.error('Failed to fetch employees');
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

  // Filter employees
  const filteredEmployees = teamEmployees.filter(emp => {
    const matchesSearch = employeeSearch === '' || 
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.department.toLowerCase().includes(employeeSearch.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || emp.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const departments = Array.from(new Set(teamEmployees.map(emp => emp.department))).sort();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Check permission
  if (!canMarkAttendance(session)) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container py-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mark Attendance</h1>
              <p className="text-muted-foreground">Mark employees as absent for a specific date</p>
            </div>
          </div>

          {/* Date Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Date
              </CardTitle>
              <CardDescription>Choose the date for which you want to mark attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Input
                  type="date"
                  value={absentDate}
                  onChange={(e) => setAbsentDate(e.target.value)}
                  max={getISTTodayDateString()}
                  className="max-w-xs"
                />
                {absentDate && (
                  <p className="text-sm text-muted-foreground">
                    {getFullDateIST(absentDate)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employees ({filteredEmployees.length})
              </CardTitle>
              <CardDescription>Search and filter employees to mark attendance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, ID, or department..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {departments.length > 1 && (
                  <div className="relative sm:w-64">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-10 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
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

              {/* Employee List */}
              {loadingTeam ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading employees...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No employees found</p>
                    <p className="text-sm text-muted-foreground">
                      {teamEmployees.length === 0 
                        ? 'No employees available' 
                        : 'Try adjusting your search or filter'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredEmployees.map((employee) => {
                    const isMarking = markingAbsent === employee.employeeId;
                    const wasRecentlyMarked = recentlyMarked.has(employee.employeeId);
                    const reportStatus = reportStatuses[employee.employeeId];
                    const isMarkedAbsentByManager = reportStatus?.status === 'leave';
                    const isMarkedPresent = reportStatus?.status === 'working';
                    
                    return (
                      <div
                        key={employee.employeeId}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                          wasRecentlyMarked 
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' 
                            : 'bg-card border-border hover:border-primary/50'
                        }`}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getInitials(employee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{employee.name}</p>
                          <p className="text-sm text-muted-foreground font-mono truncate">{employee.employeeId}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{employee.department}</span>
                            {isMarkedAbsentByManager && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">(Manager marked absent)</span>
                            )}
                            {isMarkedPresent && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Present)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleMarkAbsent(employee.employeeId)}
                            disabled={isMarking || !absentDate || isMarkedAbsentByManager}
                            variant={wasRecentlyMarked && !isMarkedPresent ? "outline" : "default"}
                            className="gap-2"
                            title={isMarkedAbsentByManager ? "Manager has already marked this employee as absent" : ""}
                          >
                            {isMarking ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Marking...
                              </>
                            ) : wasRecentlyMarked && !isMarkedPresent ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Marked
                              </>
                            ) : (
                              <>
                                <UserX className="h-4 w-4" />
                                Mark Absent
                              </>
                            )}
                          </Button>
                          {(isMarkedAbsentByManager || isMarkedPresent) && (
                            <Button
                              onClick={() => handleMarkPresent(employee.employeeId)}
                              disabled={isMarking || !absentDate}
                              variant="outline"
                              className="gap-2"
                            >
                              {isMarking ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Marking...
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4" />
                                  Mark Present
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

