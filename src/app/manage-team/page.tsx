'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Department, SafeEmployee, SessionUser } from '@/types';
import { Search, UserPlus } from 'lucide-react';
import { canMarkAttendance } from '@/lib/permissions';
import { getISTTodayDateString } from '@/lib/date';

export default function ManageTeamPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SafeEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    department: '',
  });
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterDepartmentFilter, setRosterDepartmentFilter] = useState<string>('all');

  const filteredUsers = useMemo(() => {
    const query = rosterSearch.trim().toLowerCase();
    return users.filter(u => {
      if (rosterDepartmentFilter !== 'all' && u.department !== rosterDepartmentFilter) {
        return false;
      }
      if (!query) return true;
      return (
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.employeeId.toLowerCase().includes(query)
      );
    });
  }, [users, rosterSearch, rosterDepartmentFilter]);

  const canMarkAbsent = canMarkAttendance(session);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionRes, usersRes, departmentsRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/manage-team/users'),
        fetch('/api/managers/departments'),
      ]);

      const [sessionData, usersData, departmentsData] = await Promise.all([
        sessionRes.json(),
        usersRes.json(),
        departmentsRes.json(),
      ]);

      if (sessionData.success) setSession(sessionData.data);
      if (usersData.success) setUsers(usersData.data || []);
      if (departmentsData.success) setDepartments(departmentsData.data || []);
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
    const today = getISTTodayDateString();
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

  if (loading) {
    return <div className="container py-8">Loading manage team...</div>;
  }

  if (!session || (session.role !== 'manager' && session.role !== 'teamhead')) {
    return <div className="container py-8">Unauthorized</div>;
  }

  return (
    <main className="space-y-4">
            <div className="rounded-md border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[250px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search roster by name, email or ID..."
                      className="pl-9 h-9 bg-muted/30 border-0"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-[-0.01em]">Manage Team</h1>
                  <p className="text-sm text-muted-foreground">Configure organization structure and monitoring protocols.</p>
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
                    <select
                      className="h-8 rounded-sm border bg-background px-2"
                      value={rosterDepartmentFilter}
                      onChange={(e) => setRosterDepartmentFilter(e.target.value)}
                    >
                      <option value="all">All Teams</option>
                      {departments.map(dep => (
                        <option key={`f-${dep.id}`} value={dep.name}>{dep.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="p-3">
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team users found.</p>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users match the current filters.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map(user => (
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
                            {canMarkAbsent && (
                              <Button variant="outline" size="sm" className="rounded-sm" onClick={() => handleMarkAbsent(user.employeeId)}>Absent</Button>
                            )}
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
            </div>
    </main>
  );
}
