'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, Search, Briefcase, Coffee, ArrowRight, Sparkles, Calendar, Info, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type { EmployeeLookup, WorkStatus, SessionUser } from '@/types';
import { getISTTodayDateString, getFullDateIST } from '@/lib/date';

interface EmployeeLookupWithStatus extends EmployeeLookup {
  hasSubmittedToday?: boolean;
}

export function WorkReportForm() {
  const [employeeId, setEmployeeId] = useState('');
  const [employeeData, setEmployeeData] = useState<EmployeeLookupWithStatus | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  
  const [status, setStatus] = useState<WorkStatus>('working'); // Default to 'working'
  const [workReport, setWorkReport] = useState('');
  const [onDuty, setOnDuty] = useState(false); // On Duty checkbox (optional when working)
  const [halfday, setHalfday] = useState(false); // Halfday checkbox (optional when working)
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Date selection - default to today (IST), max is today (no future dates)
  const today = getISTTodayDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  
  // Format selected date for display (IST)
  const formattedDate = getFullDateIST(selectedDate);
  
  // Check if selected date is today (IST)
  const isToday = selectedDate === today;

  // Check if user is logged in and auto-fill employee ID
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        
        if (data.success && data.data) {
          setSession(data.data);
          // Auto-fill employee ID if user is logged in
          setEmployeeId(data.data.employeeId);
        }
      } catch (err) {
        console.error('Failed to fetch session:', err);
      } finally {
        setSessionLoading(false);
      }
    };
    checkSession();
  }, []);

  // Auto-lookup employee when session is loaded and employee ID is set
  useEffect(() => {
    if (!sessionLoading && session && employeeId && !employeeData && !lookupLoading) {
      handleEmployeeLookup();
    }
  }, [sessionLoading, session, employeeId]);
  
  const handleDateChange = async (date: string) => {
    // Prevent future dates
    if (date > today) {
      toast.error('Cannot submit reports for future dates');
      return;
    }
    setSelectedDate(date);
    // Re-check for existing report on new date if employee is already looked up
    if (employeeData && employeeId.trim()) {
      const hasSubmitted = await checkExistingReport(employeeId.trim(), date);
      setEmployeeData({
        ...employeeData,
        hasSubmittedToday: hasSubmitted,
      });
    }
  };

  const checkExistingReport = async (empId: string, date: string) => {
    try {
      const response = await fetch(`/api/work-reports?employeeId=${empId}`);
      const data = await response.json();
      if (data.success && data.data.reports) {
        const existing = data.data.reports.find((r: { date: string }) => r.date === date);
        return !!existing;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleEmployeeLookup = async () => {
    if (!employeeId.trim()) {
      setLookupError('Please enter an employee ID');
      return;
    }

    setLookupLoading(true);
    setLookupError('');
    setEmployeeData(null);

    try {
      const response = await fetch(`/api/employees/${employeeId.trim()}`);
      const data = await response.json();

      if (data.success) {
        // Check if report already exists for selected date
        const hasSubmitted = await checkExistingReport(employeeId.trim(), selectedDate);
        setEmployeeData({
          ...data.data,
          hasSubmittedToday: hasSubmitted,
        });
        setLookupError('');
      } else {
        setLookupError(data.error || 'Employee not found');
      }
    } catch {
      setLookupError('Failed to lookup employee');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeData) {
      toast.error('Please lookup employee first');
      return;
    }

    if (status === 'working' && !workReport.trim()) {
      toast.error('Work report is required when status is "Working"');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/work-reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employeeData.employeeId,
          date: selectedDate,
          name: employeeData.name,
          email: employeeData.email,
          department: employeeData.department,
          status,
          workReport: workReport.trim() || null,
          onDuty: status === 'working' ? onDuty : false,
          halfday: status === 'working' ? halfday : false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Check if this is a direct update (report already exists, employee adding work report)
        if (data.data.report) {
          // Direct update - no queue involved
          setSubmitted(true);
          toast.success('Work report updated successfully!');
          setSubmitting(false);
          return;
        }
        
        // Normal submission - use queue
        const queueId = data.data.queueId;
        
        let attempts = 0;
        const maxAttempts = 30;
        
        const pollStatus = async () => {
          if (attempts >= maxAttempts) {
            toast.warning('Processing is taking longer than expected.');
            setSubmitted(true);
            return;
          }
          
          attempts++;
          
          try {
            const statusResponse = await fetch(`/api/work-reports/submit?id=${queueId}`);
            const statusData = await statusResponse.json();
            
            if (statusData.success && statusData.data) {
              if (statusData.data.status === 'completed') {
                setSubmitted(true);
                toast.success('Report submitted successfully!');
                return;
              } else if (statusData.data.status === 'failed') {
                toast.error(statusData.data.error || 'Failed to submit');
                setSubmitting(false);
                return;
              }
            }
            
            setTimeout(pollStatus, 1000);
          } catch {
            setSubmitted(true);
            toast.success('Report submitted!');
          }
        };
        
        pollStatus();
      } else {
        toast.error(data.error || 'Failed to submit');
        setSubmitting(false);
      }
    } catch {
      toast.error('An error occurred');
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    // Keep employee ID if user is logged in, otherwise clear it
    if (!session) {
      setEmployeeId('');
    }
    setEmployeeData(null);
    setLookupError('');
    setStatus('working');
    setWorkReport('');
    setOnDuty(false);
    setHalfday(false);
    setSelectedDate(today);
    setSubmitted(false);
    
    // Re-trigger lookup if user is logged in
    if (session) {
      setTimeout(() => {
        handleEmployeeLookup();
      }, 100);
    }
  };

  if (submitted) {
    return (
      <div className="border rounded-xl p-8 text-center animate-scale-in bg-card">
        <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-5 animate-fade-in">
          <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Report Submitted!</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Your work report for {formattedDate} has been recorded.
        </p>
        <Button onClick={resetForm} size="sm" className="btn-shine">
          Submit Another Report
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Show loading while checking session
  if (sessionLoading) {
    return (
      <div className="border rounded-xl overflow-hidden bg-card relative shadow-sm">
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Checking login status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-card relative shadow-sm">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b bg-card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm sm:text-base">Daily Work Report</h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {session ? `Welcome, ${session.name}` : formattedDate}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 rounded-md border bg-muted/40 px-2 py-1.5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{isToday ? 'Today' : 'Past Date'}</span>
            </div>
            <Input
              id="reportDate"
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              max={today}
              className="h-8 w-36 text-xs bg-background"
            />
          </div>
        </div>
        {!isToday && (
          <div className="mt-3 px-5 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800">
              <AlertCircle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Late Submission</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              You can submit reports for previous days
            </p>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* Employee ID Lookup */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="employeeId" className="text-sm font-medium">Employee ID</Label>
            {session && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Auto-detected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              id="employeeId"
              type="text"
              placeholder={sessionLoading ? "Checking login status..." : "Enter your employee ID"}
              value={employeeId}
              onChange={(e) => {
                if (!session) { // Only allow manual changes if not logged in
                  setEmployeeId(e.target.value);
                  setEmployeeData(null);
                  setLookupError('');
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && !session && (e.preventDefault(), handleEmployeeLookup())}
              disabled={lookupLoading || sessionLoading || !!session}
              readOnly={!!session}
              className={`flex-1 ${session ? 'bg-muted cursor-not-allowed' : ''}`}
            />
            {!session && (
              <Button 
                type="button" 
                variant="outline"
                size="icon"
                onClick={handleEmployeeLookup}
                disabled={lookupLoading || !employeeId.trim() || sessionLoading}
              >
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            )}
          </div>
          {lookupError && (
            <div className="flex items-center gap-2 text-sm text-destructive animate-fade-in">
              <AlertCircle className="h-4 w-4" />
              <span>{lookupError}</span>
            </div>
          )}
        </div>

        {/* Employee Details */}
        {employeeData && (
          <div className="p-4 bg-muted/40 rounded-lg border border-border animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <CheckCircle className="h-4 w-4" />
              Employee Verified
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{employeeData.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{employeeData.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-xs truncate max-w-[200px]">{employeeData.email}</span>
              </div>
            </div>
          </div>
        )}

        {/* Already Submitted Notice */}
        {employeeData && employeeData.hasSubmittedToday && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
              <Info className="h-4 w-4" />
              You have already submitted your work report for {isToday ? 'today' : formattedDate}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Each employee can only submit one report per day. If you need to make changes, please contact your administrator.
            </p>
          </div>
        )}

        {/* Status Selection - Compact Toggle */}
        {employeeData && !employeeData.hasSubmittedToday && (
          <div className="space-y-2 animate-fade-in">
            <Label className="text-sm font-medium">{isToday ? "Today's" : "Report"} Status</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('working')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm font-medium transition-all ${
                  status === 'working'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted/50'
                }`}
              >
                <Briefcase className="h-4 w-4" />
                Working
              </button>
              <button
                type="button"
                onClick={() => setStatus('leave')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm font-medium transition-all ${
                  status === 'leave'
                    ? 'bg-card text-foreground border-border'
                    : 'bg-background text-foreground border-border hover:bg-muted/50'
                }`}
              >
                <Coffee className="h-4 w-4" />
                On Leave
              </button>
            </div>
          </div>
        )}

        {/* On Duty and Halfday Checkboxes - Only shown when status is 'working' */}
        {employeeData && !employeeData.hasSubmittedToday && status === 'working' && (
          <div className="animate-fade-in space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* On Duty Checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={onDuty}
                    onChange={(e) => setOnDuty(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    onDuty 
                      ? 'bg-blue-600 border-blue-600' 
                      : 'border-muted-foreground/40 bg-background'
                  }`}>
                    {onDuty && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 ${onDuty ? 'text-blue-600' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${onDuty ? 'text-foreground' : 'text-muted-foreground'}`}>
                      On Duty
                    </span>
                    <span className="text-xs text-muted-foreground">(Optional)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mark if you are on duty today
                  </p>
                </div>
              </label>

              {/* Halfday Checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={halfday}
                    onChange={(e) => setHalfday(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    halfday 
                      ? 'bg-yellow-600 border-yellow-600' 
                      : 'border-muted-foreground/40 bg-background'
                  }`}>
                    {halfday && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className={`h-4 w-4 ${halfday ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${halfday ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Halfday
                    </span>
                    <span className="text-xs text-muted-foreground">(Optional)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mark if you worked half day
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Work Report */}
        {employeeData && !employeeData.hasSubmittedToday && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <Label htmlFor="workReport" className="text-sm font-medium">
                Work Report {status === 'working' && <span className="text-destructive">*</span>}
              </Label>
              <span className="text-xs text-muted-foreground">
                {status === 'working' ? 'Required' : 'Optional'}
              </span>
            </div>
            <textarea
              id="workReport"
              placeholder={
                status === 'working'
                  ? `What did you work on ${isToday ? 'today' : 'that day'}? List your tasks and accomplishments...`
                  : 'Any notes about your leave (optional)...'
              }
              value={workReport}
              onChange={(e) => setWorkReport(e.target.value)}
              className="flex min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground resize-none transition-all"
              required={status === 'working'}
            />
          </div>
        )}

        {/* Submit Button */}
        {employeeData && !employeeData.hasSubmittedToday && (
          <div className="pt-2 animate-fade-in">
            <Button type="submit" className="w-full btn-shine" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>Submit Report <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
