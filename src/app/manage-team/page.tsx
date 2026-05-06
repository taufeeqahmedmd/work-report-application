'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { toast } from 'sonner';
import type { Department, SafeEmployee, SessionUser } from '@/types';
import { Search, Bell, CircleHelp, Settings, Activity, FileText, Users, TrendingUp, Shield, UserPlus, Download, Upload } from 'lucide-react';

type TeamCheckpoint = {
  id: number;
  title: string;
  description: string | null;
  department: string;
  recurrenceType: 'one_time' | 'daily' | 'weekly' | 'monthly';
  startsOn: string | null;
  endsOn: string | null;
  dueDate: string | null;
  assigneeCount: number;
  completedCount: number;
  createdAt: string;
  assignments: Array<{
    assignmentId: number;
    employeeId: string;
    name: string | null;
    isCompleted: boolean;
  }>;
};

export default function ManageTeamPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SafeEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [checkpoints, setCheckpoints] = useState<TeamCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    department: '',
  });

  const [newCheckpoint, setNewCheckpoint] = useState({
    title: '',
    description: '',
    department: '',
    assignmentMode: 'team' as 'team' | 'individual',
    recurrenceType: 'one_time' as 'one_time' | 'daily' | 'weekly' | 'monthly',
    startsOn: '',
    endsOn: '',
    dueDate: '',
  });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [assignmentSelection, setAssignmentSelection] = useState<Record<number, string[]>>({});

  const teamUsersForSelectedDepartment = useMemo(
    () => users.filter(u => u.department === newCheckpoint.department && u.status === 'active'),
    [users, newCheckpoint.department]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionRes, usersRes, departmentsRes, checkpointsRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/manage-team/users'),
        fetch('/api/managers/departments'),
        fetch('/api/manage-team/checkpoints'),
      ]);

      const [sessionData, usersData, departmentsData, checkpointsData] = await Promise.all([
        sessionRes.json(),
        usersRes.json(),
        departmentsRes.json(),
        checkpointsRes.json(),
      ]);

      if (sessionData.success) setSession(sessionData.data);
      if (usersData.success) setUsers(usersData.data || []);
      if (departmentsData.success) setDepartments(departmentsData.data || []);
      if (checkpointsData.success) setCheckpoints(checkpointsData.data?.checkpoints || []);
    } catch {
      toast.error('Failed to load manage team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.employeeId || !newUser.name || !newUser.email || !newUser.password || !newUser.department) {
      toast.error('All user fields are required');
      return;
    }

    try {
      const response = await fetch('/api/manage-team/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to add user');
        return;
      }
      toast.success('Team user created successfully');
      setNewUser({ employeeId: '', name: '', email: '', password: '', department: '' });
      await fetchData();
    } catch {
      toast.error('Failed to add user');
    }
  };

  const handleToggleUser = async (userId: number, currentStatus: 'active' | 'inactive') => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const response = await fetch(`/api/manage-team/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to update user');
        return;
      }
      toast.success(`User ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      await fetchData();
    } catch {
      toast.error('Failed to update user');
    }
  };

  const handleMarkAbsent = async (employeeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const response = await fetch('/api/work-reports/mark-absent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, date: today }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to mark absent');
        return;
      }
      toast.success('Marked absent for today');
    } catch {
      toast.error('Failed to mark absent');
    }
  };

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckpoint.title || !newCheckpoint.department) {
      toast.error('Checkpoint title and department are required');
      return;
    }

    try {
      const response = await fetch('/api/manage-team/checkpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCheckpoint,
          employeeIds: selectedEmployeeIds,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to create checkpoint');
        return;
      }
      toast.success(data.message || 'Checkpoint created');
      setNewCheckpoint({
        title: '',
        description: '',
        department: '',
        assignmentMode: 'team',
        recurrenceType: 'one_time',
        startsOn: '',
        endsOn: '',
        dueDate: '',
      });
      setSelectedEmployeeIds([]);
      await fetchData();
    } catch {
      toast.error('Failed to create checkpoint');
    }
  };

  const handleCheckpointAssignmentUpdate = async (
    checkpointId: number,
    action: 'assign' | 'remove'
  ) => {
    const employeeIds = assignmentSelection[checkpointId] || [];
    if (employeeIds.length === 0) {
      toast.error('Select at least one user');
      return;
    }

    try {
      const response = await fetch('/api/manage-team/checkpoints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, checkpointId, employeeIds }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to update assignments');
        return;
      }
      toast.success(data.message || 'Assignments updated');
      setAssignmentSelection(prev => ({ ...prev, [checkpointId]: [] }));
      await fetchData();
    } catch {
      toast.error('Failed to update assignments');
    }
  };

  if (loading) {
    return <div className="container py-8">Loading manage team...</div>;
  }

  if (!session || (session.role !== 'manager' && session.role !== 'teamhead')) {
    return <div className="container py-8">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen pt-16 bg-background overflow-x-hidden">
      <div className="px-3 sm:px-4 md:px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:flex lg:flex-col rounded-md border border-primary/30 bg-primary text-primary-foreground overflow-hidden min-h-[calc(100vh-7.5rem)]">
            <div className="px-5 py-4 border-b border-primary-foreground/10">
              <h2 className="text-2xl font-semibold leading-none">WORK REPORT</h2>
              <p className="text-[11px] mt-1 tracking-[0.08em] text-primary-foreground/70">Enterprise Analytics</p>
            </div>
            <nav className="px-2 py-3 space-y-1">
              <Link href="/employee-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground"><Activity className="h-4 w-4" /> Dashboard</Link>
              <Link href="/team-report" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground"><FileText className="h-4 w-4" /> Reports</Link>
              <Link href="/manage-team" className="flex items-center gap-3 rounded-sm bg-primary-foreground/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em]"><Users className="h-4 w-4" /> Team Management</Link>
              <Link href="/management-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground"><TrendingUp className="h-4 w-4" /> Analytics</Link>
              <Link href="/admin" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground"><Shield className="h-4 w-4" /> Admin Portal</Link>
            </nav>
            <div className="mt-auto px-3 py-3 border-t border-primary-foreground/10">
              <div className="flex items-center justify-between rounded-sm border border-primary-foreground/20 px-3 py-2 text-xs uppercase tracking-[0.06em] text-primary-foreground/80">
                Theme
                <ThemeToggle />
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-md border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[250px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Quick search..." className="pl-9 h-9 bg-muted/30 border-0" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Bell className="h-4 w-4" /></button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><CircleHelp className="h-4 w-4" /></button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Settings className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="rounded-md border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-[-0.01em]">Manage Team</h1>
                  <p className="text-sm text-muted-foreground">Configure organization structure and monitoring protocols.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-sm"><Download className="h-4 w-4 mr-2" />Export Roster</Button>
                  <Button className="rounded-sm bg-primary text-primary-foreground"><Upload className="h-4 w-4 mr-2" />Bulk Import</Button>
                </div>
              </div>

              <form className="rounded-sm border" onSubmit={handleCreateUser}>
                <div className="px-3 py-2 border-b text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" />Add New Employee</div>
                <div className="p-3 grid gap-2 md:grid-cols-5">
                  <Input placeholder="EX-1234" value={newUser.employeeId} onChange={(e) => setNewUser(prev => ({ ...prev, employeeId: e.target.value }))} className="rounded-sm" />
                  <Input placeholder="Full Name" value={newUser.name} onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))} className="rounded-sm" />
                  <Input placeholder="Work Email" type="email" value={newUser.email} onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} className="rounded-sm" />
                  <select className="h-10 rounded-sm border bg-background px-3 text-sm" value={newUser.department} onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}>
                    <option value="">Department</option>
                    {departments.map(dep => <option key={dep.id} value={dep.name}>{dep.name}</option>)}
                  </select>
                  <Button type="submit" className="rounded-sm bg-primary text-primary-foreground">Register User</Button>
                </div>
                <div className="px-3 pb-3">
                  <Input placeholder="Set password" type="password" value={newUser.password} onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))} className="rounded-sm max-w-xs" />
                </div>
              </form>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <section className="rounded-md border bg-card overflow-hidden">
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Active Roster</h2>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Filter by:</span>
                    <select className="h-8 rounded-sm border bg-background px-2">
                      <option>All Teams</option>
                      {departments.map(dep => <option key={`f-${dep.id}`}>{dep.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="p-3">
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team users found.</p>
                  ) : (
                    <div className="space-y-2">
                      {users.map(user => (
                        <div key={user.id} className="grid grid-cols-[1.4fr_0.8fr_1fr_auto] items-center gap-3 rounded-sm border p-2">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{user.employeeId}</p>
                          <div>
                            <p className="text-sm">{user.role}</p>
                            <p className="text-xs text-muted-foreground">{user.department}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                              {user.status}
                            </span>
                            <Button variant="outline" size="sm" className="rounded-sm" onClick={() => handleMarkAbsent(user.employeeId)}>Absent</Button>
                            <Button size="sm" className="rounded-sm" variant={user.status === 'active' ? 'destructive' : 'default'} onClick={() => handleToggleUser(user.id, user.status)}>
                              {user.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-md border bg-card overflow-hidden">
                <div className="px-3 py-2 border-b text-sm font-semibold">Checkpoints</div>
                <div className="p-3 space-y-3">
                  {checkpoints.slice(0, 3).map(checkpoint => (
                    <div key={checkpoint.id} className="rounded-sm border p-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{checkpoint.title}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted uppercase">{checkpoint.recurrenceType}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{checkpoint.department} - {checkpoint.assigneeCount} assigned</p>
                    </div>
                  ))}

                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground font-semibold">Checkpoint Configuration</p>
                    <form className="space-y-2" onSubmit={handleCreateCheckpoint}>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.06em]">Checkpoint Title</Label>
                        <Input value={newCheckpoint.title} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g Incident Review" className="rounded-sm" />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.06em]">Assignment Scope</Label>
                        <select className="h-10 w-full rounded-sm border bg-background px-3 text-sm" value={newCheckpoint.assignmentMode} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, assignmentMode: e.target.value as 'team' | 'individual' }))}>
                          <option value="team">Full Organization</option>
                          <option value="individual">Individual</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.06em]">Department</Label>
                        <select className="h-10 w-full rounded-sm border bg-background px-3 text-sm" value={newCheckpoint.department} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, department: e.target.value }))}>
                          <option value="">Select department</option>
                          {departments.map(dep => <option key={`cp-${dep.id}`} value={dep.name}>{dep.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.06em]">Repeat Type</Label>
                        <select className="h-10 w-full rounded-sm border bg-background px-3 text-sm" value={newCheckpoint.recurrenceType} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, recurrenceType: e.target.value as 'one_time' | 'daily' | 'weekly' | 'monthly' }))}>
                          <option value="one_time">Fixed</option>
                          <option value="daily">Recurring - Daily</option>
                          <option value="weekly">Recurring - Weekly</option>
                          <option value="monthly">Recurring - Monthly</option>
                        </select>
                      </div>
                      {newCheckpoint.assignmentMode === 'individual' && (
                        <div className="rounded-sm border p-2">
                          <Label className="text-[11px] uppercase tracking-[0.06em]">Assign Users</Label>
                          <div className="mt-2 grid grid-cols-1 gap-1 max-h-36 overflow-auto">
                            {teamUsersForSelectedDepartment.map(user => (
                              <label key={user.employeeId} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedEmployeeIds.includes(user.employeeId)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedEmployeeIds(prev => [...prev, user.employeeId]);
                                    else setSelectedEmployeeIds(prev => prev.filter(id => id !== user.employeeId));
                                  }}
                                />
                                <span>{user.name} ({user.employeeId})</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button type="submit" className="w-full rounded-sm bg-primary text-primary-foreground">Create Checkpoint</Button>
                    </form>
                  </div>
                </div>
              </section>
            </div>

            {checkpoints.length > 0 && (
              <section className="rounded-md border bg-card p-3 space-y-3">
                <h3 className="text-sm font-semibold">Checkpoint Assignment Manager</h3>
                {checkpoints.map(checkpoint => (
                  <div key={`assign-${checkpoint.id}`} className="rounded-sm border p-3">
                    <p className="font-medium">{checkpoint.title}</p>
                    <p className="text-xs text-muted-foreground mb-2">{checkpoint.department} - {checkpoint.completedCount}/{checkpoint.assigneeCount} completed</p>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                      <select
                        multiple
                        className="min-h-20 rounded-sm border bg-background px-2 py-1 text-sm"
                        value={assignmentSelection[checkpoint.id] || []}
                        onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions).map(option => option.value);
                          setAssignmentSelection(prev => ({ ...prev, [checkpoint.id]: values }));
                        }}
                      >
                        {users
                          .filter(user => user.department === checkpoint.department && user.status === 'active')
                          .map(user => (
                            <option key={`${checkpoint.id}-${user.employeeId}`} value={user.employeeId}>
                              {user.name} ({user.employeeId})
                            </option>
                          ))}
                      </select>
                      <Button variant="outline" className="rounded-sm" onClick={() => handleCheckpointAssignmentUpdate(checkpoint.id, 'assign')}>Add to user</Button>
                      <Button variant="destructive" className="rounded-sm" onClick={() => handleCheckpointAssignmentUpdate(checkpoint.id, 'remove')}>Remove from user</Button>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
