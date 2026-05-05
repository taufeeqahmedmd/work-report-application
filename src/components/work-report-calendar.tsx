'use client';

import { useState, useMemo, memo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkReport, Holiday } from '@/types';
import { 
  getISTNow, 
  getISTTodayDateString, 
  formatDateToIST
} from '@/lib/date';

interface WorkReportCalendarProps {
  reports: WorkReport[];
  holidays?: Holiday[]; // Array of holiday objects with names
  onDateClick?: (date: string) => void;
}

function WorkReportCalendarComponent({ reports, holidays = [], onDateClick }: WorkReportCalendarProps) {
  const [currentDate, setCurrentDate] = useState(getISTNow());
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const today = getISTTodayDateString();

  // Create a map of reports by date for quick lookup
  const reportsByDate = useMemo(() => {
    const map = new Map<string, WorkReport>();
    reports.forEach(report => {
      map.set(report.date, report);
    });
    return map;
  }, [reports]);

  // Create a map of holidays by date (with names) for quick lookup
  const holidaysMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach(holiday => {
      map.set(holiday.date, holiday);
    });
    return map;
  }, [holidays]);

  // Create a set of holiday dates for quick lookup
  const holidaysSet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  // Helper function to check if a date is Sunday
  const isSunday = useCallback((dateStr: string): boolean => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDay() === 0; // 0 = Sunday
  }, []);

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(getISTNow());
  };

  // Get date status for color coding
  const getDateStatus = (dateStr: string): 'working' | 'leave' | 'not_submitted' | 'working_on_duty' | 'working_halfday' | 'working_halfday_on_duty' | 'holiday' | 'sunday' | 'future' => {
    // Check if it's Sunday first (Sunday is always a holiday)
    if (isSunday(dateStr)) {
      return 'sunday';
    }

    // Check if it's a marked holiday
    if (holidaysSet.has(dateStr)) {
      return 'holiday';
    }

    // Check if it's a future date
    if (dateStr > today) {
      return 'future';
    }

    const report = reportsByDate.get(dateStr);
    
    if (!report) {
      return 'not_submitted';
    }

    if (report.status === 'leave') {
      return 'leave';
    }

    // Check for halfday + on duty combination first
    if (report.status === 'working' && report.halfday && report.onDuty) {
      return 'working_halfday_on_duty';
    }

    if (report.status === 'working' && report.onDuty) {
      return 'working_on_duty';
    }

    if (report.status === 'working' && report.halfday) {
      return 'working_halfday';
    }

    if (report.status === 'working') {
      return 'working';
    }

    return 'not_submitted';
  };

  // Get color class for date
  const getDateColorClass = (dateStr: string, isCurrentMonth: boolean): string => {
    if (!isCurrentMonth) {
      return 'text-muted-foreground/30';
    }

    const status = getDateStatus(dateStr);
    const isToday = dateStr === today;

    switch (status) {
      case 'sunday':
        return `bg-gray-500 text-white ${isToday ? 'ring-2 ring-gray-400 ring-offset-2' : ''}`;
      case 'holiday':
        return `bg-gradient-to-br from-violet-500 to-purple-600 text-white ${isToday ? 'ring-2 ring-violet-400 ring-offset-2' : ''}`;
      case 'working':
        return `bg-emerald-500 text-white ${isToday ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`;
      case 'working_halfday':
        return `bg-yellow-500 text-white ${isToday ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`;
      case 'leave':
        return `bg-orange-500 text-white ${isToday ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`;
      case 'working_on_duty':
        // Diagonal split: green/blue - will be handled with absolute positioning
        return `relative overflow-hidden ${isToday ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`;
      case 'working_halfday_on_duty':
        // Diagonal split: yellow/blue - will be handled with absolute positioning
        return `relative overflow-hidden ${isToday ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`;
      case 'not_submitted':
        return `bg-red-500 text-white ${isToday ? 'ring-2 ring-red-400 ring-offset-2' : ''}`;
      case 'future':
        return 'text-muted-foreground/40 bg-muted/20';
      default:
        return 'text-foreground';
    }
  };

  // Get tooltip text for date
  const getTooltipText = useCallback((dateStr: string): string => {
    const status = getDateStatus(dateStr);
    
    if (status === 'sunday') {
      return `${dateStr} - Sunday (Holiday)`;
    }
    
    if (status === 'holiday') {
      const holiday = holidaysMap.get(dateStr);
      const holidayName = holiday?.name || 'Holiday';
      return `${dateStr} - ${holidayName}`;
    }
    
    const statusLabels: Record<string, string> = {
      'working': 'Working',
      'working_halfday': 'Half Day',
      'working_halfday_on_duty': 'Half Day + On Duty',
      'leave': 'Leave',
      'working_on_duty': 'Working + On Duty',
      'not_submitted': 'Not Submitted',
      'future': 'Future'
    };
    
    return `${dateStr} - ${statusLabels[status] || 'Unknown'}`;
  }, [holidaysMap, getDateStatus]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Array<{ dateStr: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month's trailing days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(currentYear, currentMonth - 1, day);
      const dateStr = formatDateToIST(date);
      days.push({ dateStr, day, isCurrentMonth: false });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dateStr = formatDateToIST(date);
      days.push({ dateStr, day, isCurrentMonth: true });
    }

    // Next month's leading days (to fill the grid)
    const totalCells = days.length;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(currentYear, currentMonth + 1, day);
      const dateStr = formatDateToIST(date);
      days.push({ dateStr, day, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth, firstDayOfMonth, daysInMonth, daysInPrevMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="w-full rounded-xl sm:rounded-2xl border bg-card shadow-sm overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="p-3 sm:p-5 border-b border-border/50 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
              <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base">Calendar</h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Work report status</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="text-xs h-8 px-3 hover:bg-primary/10 flex-shrink-0"
          >
            Today
          </Button>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h4 className="font-semibold text-base sm:text-lg tracking-tight truncate text-center">
            {monthNames[currentMonth]} {currentYear}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextMonth}
            className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 flex-shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-3 sm:p-5 bg-gradient-to-b from-card to-card/50">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2 sm:mb-3">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1.5 sm:py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarDays.map(({ dateStr, day, isCurrentMonth }) => {
            const status = getDateStatus(dateStr);
            const isToday = dateStr === today;
            const isWorkingOnDuty = status === 'working_on_duty';
            const isHalfdayOnDuty = status === 'working_halfday_on_duty';
            const hasDiagonalSplit = isWorkingOnDuty || isHalfdayOnDuty;
            
            return (
              <button
                key={dateStr}
                onClick={() => onDateClick?.(dateStr)}
                className={`
                  aspect-square rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-semibold transition-all duration-200
                  hover:scale-110 active:scale-95 hover:shadow-md relative min-w-0
                  ${getDateColorClass(dateStr, isCurrentMonth)}
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${onDateClick ? 'cursor-pointer' : 'cursor-default'}
                  ${status === 'future' ? 'hover:bg-muted/30' : ''}
                `}
                title={getTooltipText(dateStr)}
              >
                {/* Diagonal split for working_on_duty: green (top-left) and blue (bottom-right) */}
                {isWorkingOnDuty && (
                  <>
                    <div className="absolute inset-0 bg-emerald-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                    <div className="absolute inset-0 bg-blue-600" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                    <span className="relative z-10 text-white">{day}</span>
                  </>
                )}
                {/* Diagonal split for halfday_on_duty: yellow (top-left) and blue (bottom-right) */}
                {isHalfdayOnDuty && (
                  <>
                    <div className="absolute inset-0 bg-yellow-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                    <div className="absolute inset-0 bg-blue-600" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                    <span className="relative z-10 text-white">{day}</span>
                  </>
                )}
                {!hasDiagonalSplit && <span>{day}</span>}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-border/50">
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground mb-2 sm:mb-3">Legend</p>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md bg-emerald-500 shadow-sm flex-shrink-0"></div>
              <span className="text-muted-foreground font-medium truncate">Working</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md bg-yellow-500 shadow-sm flex-shrink-0"></div>
              <span className="text-muted-foreground font-medium truncate">Half Day</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md bg-orange-500 shadow-sm flex-shrink-0"></div>
              <span className="text-muted-foreground font-medium truncate">Leave</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md bg-red-500 shadow-sm flex-shrink-0"></div>
              <span className="text-muted-foreground font-medium truncate">Not Submitted</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 bg-emerald-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                <div className="absolute inset-0 bg-blue-600" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
              </div>
              <span className="text-muted-foreground font-medium truncate">On Duty</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 bg-yellow-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                <div className="absolute inset-0 bg-blue-600" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
              </div>
              <span className="text-muted-foreground font-medium truncate">Half + Duty</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md bg-gray-500 shadow-sm flex-shrink-0"></div>
              <span className="text-muted-foreground font-medium truncate">Sunday</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded sm:rounded-md bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm flex-shrink-0"></div>
              <span className="text-muted-foreground font-medium truncate">Holiday</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const WorkReportCalendar = memo(WorkReportCalendarComponent, (prevProps, nextProps) => {
  // Only re-render if reports or holidays actually change
  if (prevProps.reports.length !== nextProps.reports.length) return false;
  if (prevProps.holidays?.length !== nextProps.holidays?.length) return false;
  
  // Check if reports have changed
  const prevReportIds = prevProps.reports.map(r => `${r.id}-${r.date}`).join(',');
  const nextReportIds = nextProps.reports.map(r => `${r.id}-${r.date}`).join(',');
  if (prevReportIds !== nextReportIds) return false;
  
  // Check if holidays have changed
  const prevHolidays = prevProps.holidays?.map(h => `${h.id}-${h.date}`).join(',') || '';
  const nextHolidays = nextProps.holidays?.map(h => `${h.id}-${h.date}`).join(',') || '';
  if (prevHolidays !== nextHolidays) return false;
  
  return true; // Props are equal, skip re-render
});

