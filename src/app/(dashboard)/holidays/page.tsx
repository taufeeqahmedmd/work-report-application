'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Pencil, 
  X, 
  Check,
  Lock,
  ArrowRight,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { SessionUser, Holiday } from '@/types';
import { canMarkHolidays } from '@/lib/permissions';
import { getISTNow, getISTTodayDateString, formatDateToIST } from '@/lib/date';
import { WorkReportCalendar } from '@/components/work-report-calendar';

export default function HolidaysPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Fetch session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        if (data.success && data.data) {
          setSession(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      } finally {
        setSessionLoading(false);
      }
    };
    fetchSession();
  }, []);

  // Fetch holidays
  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/holidays?year=${selectedYear}&full=true`);
      const data = await response.json();
      if (data.success) {
        setHolidays(data.data as Holiday[]);
      } else {
        toast.error(data.error || 'Failed to fetch holidays');
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
      toast.error('Failed to fetch holidays');
    } finally {
      setLoading(false);
    }
  };

  // Fetch holidays when year changes
  useEffect(() => {
    if (session && canMarkHolidays(session)) {
      fetchHolidays();
    }
  }, [selectedYear, session]);

  const handleAddClick = () => {
    setEditingHoliday(null);
    setFormDate('');
    setFormName('');
    setShowForm(true);
  };

  const handleEditClick = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormDate(holiday.date);
    setFormName(holiday.name || '');
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingHoliday(null);
    setFormDate('');
    setFormName('');
  };

  const handleSave = async () => {
    if (!formDate) {
      toast.error('Please select a date');
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(formDate)) {
      toast.error('Invalid date format. Use YYYY-MM-DD');
      return;
    }

    setSaving(true);
    try {
      if (editingHoliday) {
        // Update existing holiday
        const response = await fetch(`/api/holidays/${editingHoliday.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName || null }),
        });

        const data = await response.json();
        if (data.success) {
          toast.success('Holiday updated successfully');
          handleCancel();
          fetchHolidays();
        } else {
          toast.error(data.error || 'Failed to update holiday');
        }
      } else {
        // Create new holiday
        const response = await fetch('/api/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: formDate, name: formName || null }),
        });

        const data = await response.json();
        if (data.success) {
          toast.success('Holiday created successfully');
          handleCancel();
          fetchHolidays();
        } else {
          toast.error(data.error || 'Failed to create holiday');
        }
      }
    } catch (error) {
      console.error('Save holiday error:', error);
      toast.error('Failed to save holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/holidays/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Holiday deleted successfully');
        fetchHolidays();
      } else {
        toast.error(data.error || 'Failed to delete holiday');
      }
    } catch (error) {
      console.error('Delete holiday error:', error);
      toast.error('Failed to delete holiday');
    } finally {
      setDeletingId(null);
    }
  };

  // Holidays are already in the correct format for calendar

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
          <p className="text-muted-foreground mb-6">Please login to access holidays management.</p>
          <Button onClick={() => window.location.href = '/login'} className="btn-shine">
            Go to Login <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Check permission
  if (!canMarkHolidays(session)) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You do not have permission to manage holidays. Please contact your administrator.
          </p>
          <Button onClick={() => window.location.href = '/employee-dashboard'} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="max-w-full">
        <div className="w-full max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Holidays Management</h1>
                  <p className="text-sm text-muted-foreground">Manage company holidays</p>
                </div>
              </div>
              <Button onClick={handleAddClick} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Holiday
              </Button>
            </div>
          </div>

          {/* Year Filter */}
          <div className="mb-6 flex items-center gap-4">
            <Label htmlFor="year-select" className="text-sm font-medium">Year:</Label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="flex h-10 w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* Holidays List */}
            <div className="space-y-6">
              {/* Add/Edit Form */}
              {showForm && (
                <div className="rounded-2xl border bg-card shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">
                      {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 w-8 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="holiday-date">Date *</Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="holiday-name">Holiday Name (Optional)</Label>
                      <Input
                        id="holiday-name"
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Republic Day, Diwali"
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button 
                        onClick={handleSave} 
                        disabled={saving || !formDate}
                        className="flex-1"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            {editingHoliday ? 'Update' : 'Save'}
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleCancel} disabled={saving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Holidays List */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      Holidays ({selectedYear})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {holidays.length} {holidays.length === 1 ? 'holiday' : 'holidays'} marked
                    </p>
                  </div>
                </div>
                
                <div className="p-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading holidays...</p>
                      </div>
                    </div>
                  ) : holidays.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
                        <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">No Holidays</h3>
                      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                        No holidays have been marked for {selectedYear}. Click &quot;Add Holiday&quot; to get started.
                      </p>
                      <Button onClick={handleAddClick} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Holiday
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {holidays.map((holiday) => (
                        <div
                          key={holiday.id}
                          className="group relative overflow-hidden rounded-xl border bg-card hover:bg-muted/30 transition-all p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0">
                                <CalendarDays className="h-6 w-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm">
                                  {holiday.name || 'Holiday'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(holiday.date).toLocaleDateString('en-IN', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(holiday)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(holiday.id)}
                                disabled={deletingId === holiday.id}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                {deletingId === holiday.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Calendar Sidebar */}
            <div className="lg:sticky lg:top-20 h-fit">
              <WorkReportCalendar 
                reports={[]} 
                holidays={holidays}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

