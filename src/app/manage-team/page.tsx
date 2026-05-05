'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { Department, SafeEmployee, SessionUser } from '@/types';

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
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manage Team</h1>
        <p className="text-sm text-muted-foreground">Manage team users, attendance and checklist checkpoints.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add Team User</CardTitle></CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={handleCreateUser}>
            <Input placeholder="Employee ID" value={newUser.employeeId} onChange={(e) => setNewUser(prev => ({ ...prev, employeeId: e.target.value }))} />
            <Input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))} />
            <Input placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} />
            <Input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={newUser.department} onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}>
              <option value="">Select department</option>
              {departments.map(dep => <option key={dep.id} value={dep.name}>{dep.name}</option>)}
            </select>
            <div className="md:col-span-3">
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team Users</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {users.length === 0 && <p className="text-sm text-muted-foreground">No team users found.</p>}
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{user.name} ({user.employeeId})</p>
                <p className="text-xs text-muted-foreground">{user.department} - {user.role}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleMarkAbsent(user.employeeId)}>Mark Absent</Button>
                <Button size="sm" variant={user.status === 'active' ? 'destructive' : 'default'} onClick={() => handleToggleUser(user.id, user.status)}>
                  {user.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team Checkpoints</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleCreateCheckpoint}>
            <div className="md:col-span-2">
              <Label>Checkpoint Title</Label>
              <Input value={newCheckpoint.title} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, title: e.target.value }))} placeholder="Example: Submit EOD update before 6 PM" />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Input value={newCheckpoint.description} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div>
              <Label>Department</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newCheckpoint.department} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, department: e.target.value }))}>
                <option value="">Select department</option>
                {departments.map(dep => <option key={dep.id} value={dep.name}>{dep.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Assignment Mode</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newCheckpoint.assignmentMode} onChange={(e) => setNewCheckpoint(prev => ({ ...prev, assignmentMode: e.target.value as 'team' | 'individual' }))}>
                <option value="team">Assign to complete team</option>
                <option value="individual">Assign selected employees</option>
              </select>
            </div>
            <div>
              <Label>Checklist Type</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={newCheckpoint.recurrenceType}
                onChange={(e) => setNewCheckpoint(prev => ({ ...prev, recurrenceType: e.target.value as 'one_time' | 'daily' | 'weekly' | 'monthly' }))}
              >
                <option value="one_time">Particular Time</option>
                <option value="daily">Recurring - Daily</option>
                <option value="weekly">Recurring - Weekly</option>
                <option value="monthly">Recurring - Monthly</option>
              </select>
            </div>

            {newCheckpoint.recurrenceType === 'one_time' ? (
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newCheckpoint.dueDate}
                  onChange={(e) => setNewCheckpoint(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={newCheckpoint.startsOn}
                    onChange={(e) => setNewCheckpoint(prev => ({ ...prev, startsOn: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={newCheckpoint.endsOn}
                    onChange={(e) => setNewCheckpoint(prev => ({ ...prev, endsOn: e.target.value }))}
                  />
                </div>
              </>
            )}

            {newCheckpoint.assignmentMode === 'individual' && (
              <div className="md:col-span-2 rounded-md border p-3">
                <Label>Select Team Members</Label>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {teamUsersForSelectedDepartment.map(user => (
                    <label key={user.employeeId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(user.employeeId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployeeIds(prev => [...prev, user.employeeId]);
                          } else {
                            setSelectedEmployeeIds(prev => prev.filter(id => id !== user.employeeId));
                          }
                        }}
                      />
                      <span>{user.name} ({user.employeeId})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <Button type="submit">Create Checkpoint</Button>
            </div>
          </form>

          <div className="space-y-2">
            {checkpoints.map(checkpoint => (
              <div key={checkpoint.id} className="rounded-md border p-3">
                <p className="font-medium">{checkpoint.title}</p>
                <p className="text-xs text-muted-foreground">{checkpoint.department} - {checkpoint.assigneeCount} assigned - {checkpoint.completedCount} completed</p>
                {checkpoint.description ? <p className="text-sm mt-1">{checkpoint.description}</p> : null}
                <p className="text-xs text-muted-foreground mt-1">
                  {checkpoint.recurrenceType === 'one_time'
                    ? `Particular time${checkpoint.dueDate ? ` (Due: ${checkpoint.dueDate})` : ''}`
                    : `Recurring: ${checkpoint.recurrenceType}${checkpoint.startsOn || checkpoint.endsOn ? ` (${checkpoint.startsOn || 'Any'} to ${checkpoint.endsOn || 'Open'})` : ''}`}
                </p>

                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <select
                    multiple
                    className="min-h-24 rounded-md border bg-background px-2 py-1 text-sm"
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
                  <Button variant="outline" onClick={() => handleCheckpointAssignmentUpdate(checkpoint.id, 'assign')}>
                    Add to user
                  </Button>
                  <Button variant="destructive" onClick={() => handleCheckpointAssignmentUpdate(checkpoint.id, 'remove')}>
                    Remove from user
                  </Button>
                </div>

                {checkpoint.assignments.length > 0 && (
                  <div className="mt-3 rounded-md border p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Current assignments</p>
                    <div className="flex flex-wrap gap-2">
                      {checkpoint.assignments.map(assignment => (
                        <span
                          key={`${checkpoint.id}-${assignment.assignmentId}`}
                          className="inline-flex items-center rounded-md border px-2 py-1 text-xs"
                        >
                          {(assignment.name || assignment.employeeId)}
                          {assignment.isCompleted ? ' (Done)' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
