'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Department, SafeEmployee, SessionUser } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ScheduleType = 'recurring' | 'limited_time';
type RecurrenceType = 'one_time' | 'daily' | 'weekly' | 'monthly';

type TeamCheckpoint = {
  id: number;
  title: string;
  description: string | null;
  department: string;
  isActive: boolean;
  recurrenceType: RecurrenceType;
  startsOn: string | null;
  endsOn: string | null;
  dueDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  dueAt: string | null;
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

export default function CheckpointsPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SafeEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [checkpoints, setCheckpoints] = useState<TeamCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCheckpointId, setBusyCheckpointId] = useState<number | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeToggleOpen, setActiveToggleOpen] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TeamCheckpoint | null>(null);

  const [assignmentSelection, setAssignmentSelection] = useState<string[]>([]);
  const [assignmentAction, setAssignmentAction] = useState<'assign' | 'remove'>('assign');

  const [editDraft, setEditDraft] = useState({
    title: '',
    description: '',
    scheduleType: 'recurring' as ScheduleType,
    recurrenceType: 'weekly' as RecurrenceType,
    startsAt: '',
    endsAt: '',
    dueAt: '',
  });

  const [newCheckpoint, setNewCheckpoint] = useState({
    department: '',
    assignmentMode: 'team' as 'team' | 'individual',
    title: '',
    description: '',
    scheduleType: 'recurring' as 'recurring' | 'limited_time',
    recurrenceType: 'one_time' as 'one_time' | 'daily' | 'weekly' | 'monthly',
    startsAt: '',
    endsAt: '',
    dueAt: '',
  });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const teamUsersForSelectedDepartment = useMemo(
    () => users.filter((u) => u.department === newCheckpoint.department && u.status === 'active'),
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
      toast.error('Failed to load checkpoints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toDateOnly = (datetime: string): string | null => {
    if (!datetime) return null;
    return datetime.split('T')[0] || null;
  };

  const formatDateTime = (value: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const formatDateOnly = (value: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const getScheduleLabel = (checkpoint: TeamCheckpoint): string => {
    if (checkpoint.recurrenceType !== 'one_time') {
      return `Recurring - ${checkpoint.recurrenceType}`;
    }
    if (checkpoint.startsAt || checkpoint.endsAt || checkpoint.startsOn || checkpoint.endsOn) {
      return 'Limited time';
    }
    return 'One time';
  };

  const getScheduleWindow = (checkpoint: TeamCheckpoint): string => {
    if (checkpoint.recurrenceType !== 'one_time') {
      if (checkpoint.dueAt) return `Due ${formatDateTime(checkpoint.dueAt)}`;
      if (checkpoint.dueDate) return `Due ${formatDateOnly(checkpoint.dueDate)}`;
      return '-';
    }
    const start = checkpoint.startsAt ? formatDateTime(checkpoint.startsAt) : formatDateOnly(checkpoint.startsOn);
    const end = checkpoint.endsAt ? formatDateTime(checkpoint.endsAt) : formatDateOnly(checkpoint.endsOn);
    if (start !== '-' || end !== '-') return `${start} -> ${end}`;
    if (checkpoint.dueAt) return `Due ${formatDateTime(checkpoint.dueAt)}`;
    if (checkpoint.dueDate) return `Due ${formatDateOnly(checkpoint.dueDate)}`;
    return '-';
  };

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCheckpoint.title || !newCheckpoint.department) {
      toast.error('Checkpoint title and department are required');
      return;
    }
    if (newCheckpoint.assignmentMode === 'individual' && selectedEmployeeIds.length === 0) {
      toast.error('Select at least one assignee for an individual checkpoint');
      return;
    }
    if (newCheckpoint.assignmentMode === 'team' && teamUsersForSelectedDepartment.length === 0) {
      toast.error('Selected department has no active team members to assign');
      return;
    }
    if (newCheckpoint.scheduleType === 'limited_time' && (!newCheckpoint.startsAt || !newCheckpoint.endsAt)) {
      toast.error('Start and end date/time are required for limited-time checklists');
      return;
    }
    if (
      newCheckpoint.scheduleType === 'limited_time' &&
      newCheckpoint.startsAt &&
      newCheckpoint.endsAt &&
      newCheckpoint.startsAt > newCheckpoint.endsAt
    ) {
      toast.error('Start date/time cannot be after end date/time');
      return;
    }

    try {
      const recurrenceType =
        newCheckpoint.scheduleType === 'limited_time' ? 'one_time' : newCheckpoint.recurrenceType;
      const response = await fetch('/api/manage-team/checkpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCheckpoint.title,
          description: newCheckpoint.description,
          department: newCheckpoint.department,
          assignmentMode: newCheckpoint.assignmentMode,
          recurrenceType,
          startsAt: newCheckpoint.scheduleType === 'limited_time' ? newCheckpoint.startsAt || null : null,
          endsAt: newCheckpoint.scheduleType === 'limited_time' ? newCheckpoint.endsAt || null : null,
          dueAt: newCheckpoint.scheduleType === 'recurring' ? newCheckpoint.dueAt || null : null,
          startsOn: newCheckpoint.scheduleType === 'limited_time' ? toDateOnly(newCheckpoint.startsAt) : null,
          endsOn: newCheckpoint.scheduleType === 'limited_time' ? toDateOnly(newCheckpoint.endsAt) : null,
          dueDate: newCheckpoint.scheduleType === 'recurring' ? toDateOnly(newCheckpoint.dueAt) : null,
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
        department: '',
        assignmentMode: 'team',
        title: '',
        description: '',
        scheduleType: 'recurring',
        recurrenceType: 'one_time',
        startsAt: '',
        endsAt: '',
        dueAt: '',
      });
      setSelectedEmployeeIds([]);
      await fetchData();
    } catch {
      toast.error('Failed to create checkpoint');
    }
  };

  const openAssignDialog = (checkpoint: TeamCheckpoint) => {
    setSelectedCheckpoint(checkpoint);
    setAssignmentSelection([]);
    setAssignmentAction('assign');
    setAssignOpen(true);
  };

  const openEditDialog = (checkpoint: TeamCheckpoint) => {
    setSelectedCheckpoint(checkpoint);
    const scheduleType =
      checkpoint.recurrenceType !== 'one_time' ? 'recurring' : (checkpoint.startsAt || checkpoint.endsAt || checkpoint.startsOn || checkpoint.endsOn) ? 'limited_time' : 'recurring';
    setEditDraft({
      title: checkpoint.title,
      description: checkpoint.description || '',
      scheduleType,
      recurrenceType: checkpoint.recurrenceType,
      startsAt: checkpoint.startsAt ? checkpoint.startsAt.slice(0, 16) : '',
      endsAt: checkpoint.endsAt ? checkpoint.endsAt.slice(0, 16) : '',
      dueAt: checkpoint.dueAt ? checkpoint.dueAt.slice(0, 16) : '',
    });
    setEditOpen(true);
  };

  const openActiveToggleDialog = (checkpoint: TeamCheckpoint) => {
    setSelectedCheckpoint(checkpoint);
    setActiveToggleOpen(true);
  };

  const handleAssignmentsSubmit = async () => {
    if (!selectedCheckpoint) return;
    if (assignmentSelection.length === 0) {
      toast.error('Select at least one user');
      return;
    }
    setBusyCheckpointId(selectedCheckpoint.id);
    try {
      const response = await fetch('/api/manage-team/checkpoints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: assignmentAction,
          checkpointId: selectedCheckpoint.id,
          employeeIds: assignmentSelection,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to update assignments');
        return;
      }
      toast.success(data.message || 'Assignments updated');
      setAssignOpen(false);
      await fetchData();
    } catch {
      toast.error('Failed to update assignments');
    } finally {
      setBusyCheckpointId(null);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedCheckpoint) return;
    if (!editDraft.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const scheduleType = editDraft.scheduleType;
    const recurrenceType = scheduleType === 'limited_time' ? 'one_time' : editDraft.recurrenceType;
    const startsAt = scheduleType === 'limited_time' ? (editDraft.startsAt || null) : null;
    const endsAt = scheduleType === 'limited_time' ? (editDraft.endsAt || null) : null;
    const dueAt = scheduleType === 'recurring' ? (editDraft.dueAt || null) : null;
    if (scheduleType === 'limited_time' && (!startsAt || !endsAt)) {
      toast.error('Start and end date/time are required for limited-time checklists');
      return;
    }
    if (scheduleType === 'limited_time' && startsAt && endsAt && startsAt > endsAt) {
      toast.error('Start cannot be after end');
      return;
    }

    setBusyCheckpointId(selectedCheckpoint.id);
    try {
      const response = await fetch('/api/manage-team/checkpoints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          checkpointId: selectedCheckpoint.id,
          title: editDraft.title.trim(),
          description: editDraft.description.trim(),
          recurrenceType,
          startsAt,
          endsAt,
          dueAt,
          startsOn: scheduleType === 'limited_time' ? toDateOnly(startsAt || '') : null,
          endsOn: scheduleType === 'limited_time' ? toDateOnly(endsAt || '') : null,
          dueDate: scheduleType === 'recurring' ? toDateOnly(dueAt || '') : null,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to update checklist');
        return;
      }
      toast.success(data.message || 'Checklist updated');
      setEditOpen(false);
      await fetchData();
    } catch {
      toast.error('Failed to update checklist');
    } finally {
      setBusyCheckpointId(null);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedCheckpoint) return;
    const next = !selectedCheckpoint.isActive;
    setBusyCheckpointId(selectedCheckpoint.id);
    try {
      const response = await fetch('/api/manage-team/checkpoints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          checkpointId: selectedCheckpoint.id,
          isActive: next,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to update status');
        return;
      }
      toast.success(data.message || (next ? 'Activated' : 'Deactivated'));
      setActiveToggleOpen(false);
      await fetchData();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusyCheckpointId(null);
    }
  };

  if (loading) {
    return <div className="container py-8">Loading checkpoints...</div>;
  }

  if (!session || (session.role !== 'manager' && session.role !== 'teamhead')) {
    return <div className="container py-8">Unauthorized</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4 border-b pb-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">Checklist Management</h1>
            <p className="text-sm text-muted-foreground">Create recurring and limited-time checklist workflows.</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="rounded-md border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">Create Checklist</div>
            <div className="p-3 space-y-3">
              <form className="space-y-3" onSubmit={handleCreateCheckpoint}>
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Select Department</Label>
                  <select
                    className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                    value={newCheckpoint.department}
                    onChange={(e) => setNewCheckpoint((prev) => ({ ...prev, department: e.target.value }))}
                  >
                    <option value="">Select department</option>
                    {departments.map((dep) => (
                      <option key={`cp-${dep.id}`} value={dep.name}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Select Users / Team</Label>
                  <select
                    className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                    value={newCheckpoint.assignmentMode}
                    onChange={(e) =>
                      setNewCheckpoint((prev) => ({
                        ...prev,
                        assignmentMode: e.target.value as 'team' | 'individual',
                      }))
                    }
                  >
                    <option value="team">Entire Team</option>
                    <option value="individual">Specific Users</option>
                  </select>
                </div>

                {newCheckpoint.assignmentMode === 'individual' && (
                  <div className="rounded-sm border p-2">
                    <Label className="text-[11px] uppercase tracking-[0.06em]">Assignees</Label>
                    <div className="mt-2 grid grid-cols-1 gap-1 max-h-40 overflow-auto">
                      {teamUsersForSelectedDepartment.map((user) => (
                        <label key={user.employeeId} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(user.employeeId)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedEmployeeIds((prev) => [...prev, user.employeeId]);
                              else setSelectedEmployeeIds((prev) => prev.filter((id) => id !== user.employeeId));
                            }}
                          />
                          <span>
                            {user.name} ({user.employeeId})
                          </span>
                        </label>
                      ))}
                      {newCheckpoint.department && teamUsersForSelectedDepartment.length === 0 && (
                        <p className="text-xs text-muted-foreground">No active users in this department.</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Checklist Title</Label>
                  <Input
                    value={newCheckpoint.title}
                    onChange={(e) => setNewCheckpoint((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g Weekly Financial Audit"
                    className="rounded-sm"
                  />
                </div>

                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Description (optional)</Label>
                  <Input
                    value={newCheckpoint.description}
                    onChange={(e) => setNewCheckpoint((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Short description"
                    className="rounded-sm"
                  />
                </div>

                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Schedule Type</Label>
                  <select
                    className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                    value={newCheckpoint.scheduleType}
                    onChange={(e) =>
                      setNewCheckpoint((prev) => ({
                        ...prev,
                        scheduleType: e.target.value as 'recurring' | 'limited_time',
                      }))
                    }
                  >
                    <option value="recurring">Recurrence</option>
                    <option value="limited_time">Limited Time</option>
                  </select>
                </div>

                {newCheckpoint.scheduleType === 'recurring' ? (
                  <>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.06em]">Recurrence</Label>
                      <select
                        className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                        value={newCheckpoint.recurrenceType}
                        onChange={(e) =>
                          setNewCheckpoint((prev) => ({
                            ...prev,
                            recurrenceType: e.target.value as 'one_time' | 'daily' | 'weekly' | 'monthly',
                          }))
                        }
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="one_time">One time</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.06em]">Due Date & Time (optional)</Label>
                      <Input
                        type="datetime-local"
                        value={newCheckpoint.dueAt}
                        onChange={(e) => setNewCheckpoint((prev) => ({ ...prev, dueAt: e.target.value }))}
                        className="rounded-sm"
                      />
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.06em]">Start Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={newCheckpoint.startsAt}
                        onChange={(e) => setNewCheckpoint((prev) => ({ ...prev, startsAt: e.target.value }))}
                        className="rounded-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.06em]">End Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={newCheckpoint.endsAt}
                        onChange={(e) => setNewCheckpoint((prev) => ({ ...prev, endsAt: e.target.value }))}
                        className="rounded-sm"
                      />
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full rounded-sm bg-primary text-primary-foreground">
                  Create Checklist
                </Button>
              </form>
            </div>
          </section>

          <section className="rounded-md border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">List of Checklists</div>
            <div className="p-3 overflow-x-auto">
              {checkpoints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No checkpoints yet.</p>
              ) : (
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Assigned To</th>
                      <th className="py-2 pr-3 font-semibold">Title</th>
                      <th className="py-2 pr-3 font-semibold">Type</th>
                      <th className="py-2 pr-3 font-semibold">Date & Time</th>
                      <th className="py-2 pr-3 font-semibold">Progress</th>
                      <th className="py-2 pr-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkpoints.map((checkpoint) => (
                      <tr key={checkpoint.id} className="border-b last:border-b-0 align-top">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{checkpoint.department}</p>
                          <p className="text-xs text-muted-foreground">
                            {checkpoint.assigneeCount} user(s)
                            {checkpoint.assignments.length > 0 && checkpoint.assignments.length <= 3
                              ? `: ${checkpoint.assignments.map((a) => a.name || a.employeeId).join(', ')}`
                              : ''}
                          </p>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{checkpoint.title}</p>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-sm uppercase ${
                                checkpoint.isActive ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {checkpoint.isActive ? 'active' : 'inactive'}
                            </span>
                          </div>
                          {checkpoint.description ? (
                            <p className="text-xs text-muted-foreground">{checkpoint.description}</p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">{getScheduleLabel(checkpoint)}</td>
                        <td className="py-2 pr-3">{getScheduleWindow(checkpoint)}</td>
                        <td className="py-2 pr-3">
                          {checkpoint.completedCount}/{checkpoint.assigneeCount} completed
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-sm"
                              onClick={() => openEditDialog(checkpoint)}
                              disabled={busyCheckpointId === checkpoint.id}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-sm"
                              onClick={() => openAssignDialog(checkpoint)}
                              disabled={busyCheckpointId === checkpoint.id}
                            >
                              Assign/Remove
                            </Button>
                            <Button
                              variant={checkpoint.isActive ? 'destructive' : 'default'}
                              size="sm"
                              className="rounded-sm"
                              onClick={() => openActiveToggleDialog(checkpoint)}
                              disabled={busyCheckpointId === checkpoint.id}
                            >
                              {checkpoint.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign / Remove users</DialogTitle>
            <DialogDescription>
              {selectedCheckpoint ? `${selectedCheckpoint.title} (${selectedCheckpoint.department})` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-[0.06em]">Action</Label>
              <select
                className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                value={assignmentAction}
                onChange={(e) => setAssignmentAction(e.target.value as 'assign' | 'remove')}
              >
                <option value="assign">Assign</option>
                <option value="remove">Remove</option>
              </select>
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-[0.06em]">Users</Label>
              <select
                multiple
                className="min-h-40 w-full rounded-sm border bg-background px-2 py-2 text-sm"
                value={assignmentSelection}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setAssignmentSelection(values);
                }}
              >
                {(selectedCheckpoint
                  ? users.filter((u) => u.department === selectedCheckpoint.department && u.status === 'active')
                  : []
                ).map((u) => (
                  <option key={u.employeeId} value={u.employeeId}>
                    {u.name} ({u.employeeId})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Command to select multiple users.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-sm" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-sm" onClick={handleAssignmentsSubmit} disabled={busyCheckpointId === selectedCheckpoint?.id}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit checklist</DialogTitle>
            <DialogDescription>
              {selectedCheckpoint ? `${selectedCheckpoint.department}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-[0.06em]">Title</Label>
              <Input
                value={editDraft.title}
                onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
                className="rounded-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-[0.06em]">Description</Label>
              <Input
                value={editDraft.description}
                onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                className="rounded-sm"
              />
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-[0.06em]">Schedule Type</Label>
              <select
                className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                value={editDraft.scheduleType}
                onChange={(e) => {
                  const next = e.target.value === 'limited_time' ? 'limited_time' : 'recurring';
                  setEditDraft((p) => ({ ...p, scheduleType: next }));
                }}
              >
                <option value="recurring">Recurrence</option>
                <option value="limited_time">Limited Time</option>
              </select>
            </div>

            {editDraft.scheduleType === 'recurring' ? (
              <>
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Recurrence</Label>
                  <select
                    className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                    value={editDraft.recurrenceType}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next: RecurrenceType =
                        raw === 'daily' || raw === 'weekly' || raw === 'monthly' || raw === 'one_time'
                          ? raw
                          : 'one_time';
                      setEditDraft((p) => ({ ...p, recurrenceType: next }));
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="one_time">One time</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Due Date & Time (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={editDraft.dueAt}
                    onChange={(e) => setEditDraft((p) => ({ ...p, dueAt: e.target.value }))}
                    className="rounded-sm"
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">Start Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={editDraft.startsAt}
                    onChange={(e) => setEditDraft((p) => ({ ...p, startsAt: e.target.value }))}
                    className="rounded-sm"
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em]">End Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={editDraft.endsAt}
                    onChange={(e) => setEditDraft((p) => ({ ...p, endsAt: e.target.value }))}
                    className="rounded-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-sm" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-sm" onClick={handleEditSubmit} disabled={busyCheckpointId === selectedCheckpoint?.id}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeToggleOpen} onOpenChange={setActiveToggleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCheckpoint?.isActive ? 'Deactivate' : 'Activate'} checklist</DialogTitle>
            <DialogDescription>
              {selectedCheckpoint ? selectedCheckpoint.title : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedCheckpoint?.isActive
              ? 'Deactivated checklists will stop showing on employee dashboards.'
              : 'Activating will make this checklist visible to assigned employees again.'}
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-sm" onClick={() => setActiveToggleOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedCheckpoint?.isActive ? 'destructive' : 'default'}
              className="rounded-sm"
              onClick={handleToggleActive}
              disabled={busyCheckpointId === selectedCheckpoint?.id}
            >
              {selectedCheckpoint?.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

