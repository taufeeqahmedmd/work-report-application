'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Users, Search, Pencil, Trash2, X, Key, Upload, Download, FileJson, FileSpreadsheet, Check, Filter, UserX, UserCheck, CheckCircle2, Calendar, Building2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { SafeEmployee, SessionUser, Department } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getISTTodayDateString, getFullDateIST } from '@/lib/date';
import type { SafeEmployee as SafeEmployeeType } from '@/types';

export default function AdminPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SafeEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    department: '',
    departmentIds: [] as number[],
    password: '',
    role: 'employee' as 'employee' | 'manager' | 'teamhead' | 'admin' | 'boardmember',
  });

  // Edit user state
  const [editingUser, setEditingUser] = useState<SafeEmployee | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    department: '',
    departmentIds: [] as number[],
    password: '',
    role: 'employee' as 'employee' | 'manager' | 'teamhead' | 'admin' | 'boardmember',
    status: 'active' as 'active' | 'inactive',
  });

  // Bulk upload
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFormat, setBulkUploadFormat] = useState<'csv' | 'json' | null>(null);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  // Mark Absent state
  const [markingAbsent, setMarkingAbsent] = useState<string | null>(null);
  const [absentDate, setAbsentDate] = useState(getISTTodayDateString());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamEmployees, setTeamEmployees] = useState<SafeEmployeeType[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSession();
    fetchData();
  }, []);

  // Fetch team employees when sheet opens
  useEffect(() => {
    if (dialogOpen && session?.pageAccess?.mark_attendance) {
      fetchTeamEmployees();
    }
  }, [dialogOpen, session]);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data.success) setSession(data.data);
    } catch (error) {
      console.error('Failed to fetch session:', error);
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, departmentsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/departments'),
      ]);
      
      const [usersData, departmentsData] = await Promise.all([
        usersRes.json(),
        departmentsRes.json(),
      ]);

      if (usersData.success) {
        setUsers(usersData.data || []);
      } else {
        toast.error(usersData.error || 'Failed to fetch users');
      }
      
      if (departmentsData.success) {
        setDepartments(departmentsData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show confirmation dialog
    setConfirmTitle('Create User');
    setConfirmMessage('Are you sure you want to create this user with the specified settings?');
    setConfirmAction(() => async () => {
      setShowConfirmDialog(false);
      await performCreateUser();
    });
    setShowConfirmDialog(true);
  };

  const performCreateUser = async () => {
    setCreating(true);

    try {
      // Determine department based on role
      let primaryDepartment = formData.department;
      if (formData.role === 'manager' && formData.departmentIds.length > 0) {
        // For managers, use first selected department as primary
        primaryDepartment = departments.find(d => d.id === formData.departmentIds[0])?.name || formData.department;
      } else if (formData.role === 'boardmember') {
        // Board members have access across all - set department as "Board"
        primaryDepartment = 'Board';
      } else if (formData.role === 'admin') {
        // Admins don't need department
        primaryDepartment = 'Admin';
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          department: primaryDepartment,
          entityId: formData.role === 'boardmember' ? null : (session?.entityId || null),
          branchId: formData.role === 'boardmember' ? null : (session?.branchId || null),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // If manager, set their departments
        if (formData.role === 'manager' && formData.departmentIds.length > 0) {
          await fetch(`/api/admin/users/${data.data.id}/departments`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ departmentIds: formData.departmentIds }),
          });
        }

        toast.success('User created successfully');
        setFormData({ employeeId: '', name: '', email: '', department: '', departmentIds: [], password: '', role: 'employee' });
        setShowCreateForm(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error('Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleDepartmentToggle = (deptId: number) => {
    setFormData(prev => ({
      ...prev,
      departmentIds: prev.departmentIds.includes(deptId)
        ? prev.departmentIds.filter(id => id !== deptId)
        : [...prev.departmentIds, deptId]
    }));
  };

  const handleEditDepartmentToggle = (deptId: number) => {
    setEditFormData(prev => ({
      ...prev,
      departmentIds: prev.departmentIds.includes(deptId)
        ? prev.departmentIds.filter(id => id !== deptId)
        : [...prev.departmentIds, deptId]
    }));
  };

  const openEditModal = async (user: SafeEmployee) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      department: user.department,
      departmentIds: [],
      password: '',
      role: user.role as 'employee' | 'manager' | 'teamhead' | 'admin' | 'boardmember',
      status: user.status,
    });

    // If user is a manager, fetch their departments
    if (user.role === 'manager') {
      try {
        const res = await fetch(`/api/admin/users/${user.id}/departments`);
        const data = await res.json();
        if (data.success && data.data) {
          setEditFormData(prev => ({
            ...prev,
            departmentIds: data.data.map((d: Department) => d.id)
          }));
        }
      } catch (error) {
        console.error('Failed to fetch manager departments:', error);
      }
    }

    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Show confirmation dialog
    setConfirmTitle('Update User');
    setConfirmMessage(`Are you sure you want to save the changes for ${editingUser.name}? This will update their settings.`);
    setConfirmAction(() => async () => {
      setShowConfirmDialog(false);
      await performUpdateUser();
    });
    setShowConfirmDialog(true);
  };

  const performUpdateUser = async () => {
    if (!editingUser) return;

    setUpdatingUser(true);

    try {
      const updatePayload: Record<string, unknown> = {};
      
      if (editFormData.name !== editingUser.name) updatePayload.name = editFormData.name;
      if (editFormData.email !== editingUser.email) updatePayload.email = editFormData.email;
      if (editFormData.department !== editingUser.department) updatePayload.department = editFormData.department;
      if (editFormData.password) updatePayload.password = editFormData.password;
      
      // Only superadmin can change role and status
      if (session?.role === 'superadmin') {
        if (editFormData.role !== editingUser.role) updatePayload.role = editFormData.role;
        if (editFormData.status !== editingUser.status) updatePayload.status = editFormData.status;
      }

      // For manager, update department to primary selected
      if (editFormData.role === 'manager' && editFormData.departmentIds.length > 0) {
        const primaryDept = departments.find(d => d.id === editFormData.departmentIds[0]);
        if (primaryDept) updatePayload.department = primaryDept.name;
      }

      // For board members, set department to "Board"
      if (editFormData.role === 'boardmember') {
        updatePayload.department = 'Board';
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const data = await response.json();

      if (data.success) {
        // If manager, update their departments
        if (editFormData.role === 'manager' && editFormData.departmentIds.length > 0) {
          await fetch(`/api/admin/users/${editingUser.id}/departments`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ departmentIds: editFormData.departmentIds }),
          });
        }

        toast.success('User updated successfully');
        setShowEditModal(false);
        setEditingUser(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;
    
    const newPassword = prompt('Enter new password for ' + editingUser.name + ':');
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Password reset successfully');
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast.error('Failed to reset password');
    }
  };

  const handleDeactivateUser = async (userId: number) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('User deactivated successfully');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to deactivate user');
      }
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      toast.error('Failed to deactivate user');
    }
  };

  const downloadTemplate = (format: 'csv' | 'json') => {
    const templateData = [
      {
        employeeId: 'EMP001',
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'employee',
        departmentName: 'Websites',
      },
      {
        employeeId: 'EMP002',
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'manager',
        departmentName: 'Graphics|Websites|Social Media', // Use | for multiple departments
      },
      {
        employeeId: 'EMP003',
        name: 'Board Member',
        email: 'board@example.com',
        password: 'password123',
        role: 'boardmember',
        departmentName: '', // Leave empty for boardmember
      },
      {
        employeeId: 'EMP004',
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        departmentName: '', // Leave empty for admin
      },
    ];

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(templateData, null, 2);
      filename = 'users_template.json';
      mimeType = 'application/json';
    } else {
      const headers = ['employeeId', 'name', 'email', 'password', 'role', 'departmentName'];
      const csvRows = [
        headers.join(','),
        ...templateData.map(row => 
          headers.map(h => `"${row[h as keyof typeof row]}"`).join(',')
        )
      ];
      content = csvRows.join('\n');
      filename = 'users_template.csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTemplateDownloaded(true);
    toast.success(`Template downloaded: ${filename}`);
  };

  const handleBulkUpload = async () => {
    if (!bulkUploadFile || !bulkUploadFormat || !session) return;

    setBulkUploading(true);
    try {
      const fileContent = await bulkUploadFile.text();
      let usersData: Array<{
        employeeId: string;
        name: string;
        email: string;
        password: string;
        role: string;
        departmentName: string;
      }>;

      if (bulkUploadFormat === 'json') {
        usersData = JSON.parse(fileContent);
      } else {
        const lines = fileContent.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        usersData = lines.slice(1).map(line => {
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = (values[index] || '').replace(/"/g, '').trim();
          });
          return obj as typeof usersData[0];
        });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const userData of usersData) {
        try {
          const role = userData.role?.toLowerCase() || 'employee';
          
          // Handle boardmember - they don't need department
          if (role === 'boardmember') {
            const response = await fetch('/api/admin/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: userData.employeeId,
                name: userData.name,
                email: userData.email,
                password: userData.password,
                role: 'boardmember',
                entityId: null,
                branchId: null,
                department: 'Board',
              }),
            });

            const data = await response.json();
            if (data.success) {
              successCount++;
            } else {
              errors.push(`${userData.employeeId}: ${data.error}`);
              errorCount++;
            }
            continue;
          }

          // Handle admin - they don't need department (only superadmin can create admins)
          if (role === 'admin') {
            if (session.role !== 'superadmin') {
              errors.push(`${userData.employeeId}: Only Super Admins can create Admin users`);
              errorCount++;
              continue;
            }

            const response = await fetch('/api/admin/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: userData.employeeId,
                name: userData.name,
                email: userData.email,
                password: userData.password,
                role: 'admin',
                entityId: session.entityId || null,
                branchId: session.branchId || null,
                department: 'Admin',
              }),
            });

            const data = await response.json();
            if (data.success) {
              successCount++;
            } else {
              errors.push(`${userData.employeeId}: ${data.error}`);
              errorCount++;
            }
            continue;
          }

          // Handle manager with multiple departments (separated by |)
          const departmentNames = userData.departmentName?.split('|').map(d => d.trim()).filter(d => d) || [];
          
          if (departmentNames.length === 0) {
            errors.push(`${userData.employeeId}: Department name is required`);
            errorCount++;
            continue;
          }

          // Validate all departments exist
          const foundDepartments = departmentNames.map(deptName => 
            departments.find(d => d.name.toLowerCase() === deptName.toLowerCase())
          );

          const missingDepts = departmentNames.filter((name, idx) => !foundDepartments[idx]);
          if (missingDepts.length > 0) {
            errors.push(`${userData.employeeId}: Department(s) "${missingDepts.join(', ')}" not found`);
            errorCount++;
            continue;
          }

          // Use first department as primary
          const primaryDepartment = foundDepartments[0];

          const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: userData.employeeId,
              name: userData.name,
              email: userData.email,
              password: userData.password,
              role: role,
              entityId: session.entityId || null,
              branchId: session.branchId || null,
              department: primaryDepartment?.name || departmentNames[0],
            }),
          });

          const data = await response.json();

          if (data.success) {
            // If manager with multiple departments, assign all departments
            if (role === 'manager' && foundDepartments.length > 1) {
              const deptIds = foundDepartments.filter(d => d).map(d => d!.id);
              await fetch(`/api/admin/users/${data.data.id}/departments`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ departmentIds: deptIds }),
              });
            }
            successCount++;
          } else {
            errors.push(`${userData.employeeId}: ${data.error}`);
            errorCount++;
          }
        } catch {
          errors.push(`${userData.employeeId}: Failed to create user`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} user(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} user(s). Check console for details.`);
        console.error('Bulk upload errors:', errors);
      }

      setShowBulkUploadModal(false);
      setBulkUploadFormat(null);
      setTemplateDownloaded(false);
      setBulkUploadFile(null);
      fetchData();
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast.error('Failed to parse file. Please check the format.');
    } finally {
      setBulkUploading(false);
    }
  };

  const closeBulkUploadModal = () => {
    setShowBulkUploadModal(false);
    setBulkUploadFormat(null);
    setTemplateDownloaded(false);
    setBulkUploadFile(null);
  };

  // Fetch team employees for Mark Absent
  const fetchTeamEmployees = async () => {
    setLoadingTeam(true);
    try {
      const response = await fetch('/api/managers/team');
      const data = await response.json();
      if (data.success) setTeamEmployees(data.data || []);
    } catch (error) {
      console.error('Failed to fetch team employees:', error);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Handle marking employee as absent
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

  // Filter employees for mark absent modal
  const filteredEmployees = teamEmployees.filter(emp => {
    const matchesSearch = employeeSearch === '' || 
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.department.toLowerCase().includes(employeeSearch.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || emp.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const markAbsentDepartments = Array.from(new Set(teamEmployees.map(emp => emp.department))).sort();

  const filteredUsers = users.filter(user => {
    if (searchTerm === '') return true;
    return (
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16">
      <div className="container py-8 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Manage users {session?.role === 'admin' ? 'in your branch' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                {showCreateForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {showCreateForm ? 'Cancel' : 'Add User'}
              </Button>
              <Button variant="outline" onClick={() => setShowBulkUploadModal(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              {session?.pageAccess?.mark_attendance && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <UserX className="h-4 w-4" />
                      Mark Attendance
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0">
                    {/* Header with gradient */}
                    <div className="relative px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                          <UserX className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="flex-1">
                          <DialogTitle className="text-xl font-bold">Mark Employee as Absent</DialogTitle>
                          <DialogDescription className="text-sm mt-1">
                            {session?.role === 'manager'
                              ? 'Select an employee and date to mark them as absent. You can only mark employees in your assigned departments.'
                              : session?.department === 'Operations'
                              ? 'Select an employee and date to mark them as absent. You can mark employees from your assigned departments or all employees if no departments are assigned.'
                              : 'Select an employee and date to mark them as absent.'}
                          </DialogDescription>
                        </div>
                      </div>
                    </div>
                    
                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                      {/* Date Selection Card */}
                      <div className="relative p-4 rounded-xl bg-gradient-to-br from-card/80 to-card/50 border border-border/50 backdrop-blur-sm shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <label className="text-sm font-semibold">Select Date</label>
                        </div>
                        <Input
                          type="date"
                          value={absentDate}
                          onChange={(e) => setAbsentDate(e.target.value)}
                          max={getISTTodayDateString()}
                          className="w-full h-11 bg-background/50 border-border/50 focus:border-primary/50"
                        />
                        {absentDate && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {getFullDateIST(absentDate)}
                          </p>
                        )}
                      </div>

                      {/* Stats Card */}
                      <div className="relative p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{filteredEmployees.length}</p>
                              <p className="text-xs text-muted-foreground">
                                {filteredEmployees.length === 1 ? 'Employee' : 'Employees'} Available
                              </p>
                            </div>
                          </div>
                          {teamEmployees.length > 0 && (
                            <div className="text-right">
                              <p className="text-sm font-medium text-muted-foreground">Total</p>
                              <p className="text-lg font-bold">{teamEmployees.length}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Search and Filter */}
                      {teamEmployees.length > 0 && (
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search by name, ID, or department..."
                              value={employeeSearch}
                              onChange={(e) => setEmployeeSearch(e.target.value)}
                              className="pl-11 h-11 bg-background/50 border-border/50 focus:border-primary/50"
                            />
                          </div>
                          {markAbsentDepartments.length > 1 && (
                            <div className="relative">
                              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                              <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="flex h-11 w-full rounded-lg border border-border/50 bg-background/50 px-4 pl-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 appearance-none cursor-pointer"
                              >
                                <option value="all">All Departments</option>
                                {markAbsentDepartments.map(dept => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Employee List */}
                      {loadingTeam ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                          <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-4 border-muted" />
                            <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                          </div>
                          <p className="text-sm text-muted-foreground">Loading employees...</p>
                        </div>
                      ) : teamEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <Users className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-1">No employees found</p>
                            <p className="text-xs text-muted-foreground">
                              {session?.role === 'manager'
                                ? 'No employees are assigned to your departments yet.'
                                : 'No employees available to mark as absent.'}
                            </p>
                          </div>
                        </div>
                      ) : filteredEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <Search className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-1">No employees match your search</p>
                            <p className="text-xs text-muted-foreground">
                              Try adjusting your search or filter criteria.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                          {filteredEmployees.map((employee) => {
                            const isMarking = markingAbsent === employee.employeeId;
                            const isRecentlyMarked = recentlyMarked.has(employee.employeeId);
                            return (
                              <div
                                key={employee.employeeId}
                                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                                  isRecentlyMarked
                                    ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-2 border-emerald-500/30 shadow-sm'
                                    : 'bg-gradient-to-br from-card/80 to-card/50 border border-border/50 hover:border-primary/30 hover:shadow-md'
                                }`}
                              >
                                {/* Gradient accent bar */}
                                {isRecentlyMarked && (
                                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
                                )}
                                
                                <div className="p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                      {/* Avatar */}
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                        isRecentlyMarked
                                          ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white'
                                          : 'bg-gradient-to-br from-primary/10 to-primary/5 text-primary'
                                      }`}>
                                        {employee.name.charAt(0).toUpperCase()}
                                      </div>
                                      
                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="font-semibold text-sm truncate">{employee.name}</h4>
                                          {isRecentlyMarked && (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 font-mono">
                                            {employee.employeeId}
                                          </span>
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50">
                                            <Building2 className="h-3 w-3" />
                                            {employee.department}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Action Button */}
                                    <Button
                                      size="sm"
                                      onClick={() => handleMarkAbsent(employee.employeeId)}
                                      disabled={isMarking || !absentDate}
                                      className={`flex-shrink-0 gap-2 transition-all ${
                                        isRecentlyMarked
                                          ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white'
                                          : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
                                      }`}
                                    >
                                      {isMarking ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          <span>Marking...</span>
                                        </>
                                      ) : isRecentlyMarked ? (
                                        <>
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          <span>Marked</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-3.5 w-3.5" />
                                          <span>Mark Absent</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="border rounded-lg p-6 mb-8">
              <h2 className="font-semibold mb-4">Create New User</h2>
              <form onSubmit={handleCreateUser} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    placeholder="EMP001"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'employee' | 'manager' | 'teamhead' | 'admin' | 'boardmember', department: '', departmentIds: [] })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="teamhead">Team Head</option>
                    <option value="boardmember">Board Member</option>
                    {session?.role === 'superadmin' && <option value="admin">Admin</option>}
                  </select>
                </div>

                {/* Department dropdown for employees only */}
                {formData.role === 'employee' && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <select
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Admin info message */}
                {formData.role === 'admin' && (
                  <div className="sm:col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Admins have administrative access. Department assignment is not required.
                    </p>
                  </div>
                )}

                {/* Board member info message */}
                {formData.role === 'boardmember' && (
                  <div className="sm:col-span-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Board Members have access across all departments, entities, and branches. No department assignment required.
                    </p>
                  </div>
                )}

                {/* Departments multi-select for managers */}
                {formData.role === 'manager' && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Departments (Select multiple)</Label>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                      {departments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No departments available.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {departments.map((dept) => (
                            <label
                              key={dept.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                                formData.departmentIds.includes(dept.id)
                                  ? 'bg-primary/10 border border-primary'
                                  : 'bg-muted/50 hover:bg-muted'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.departmentIds.includes(dept.id)}
                                onChange={() => handleDepartmentToggle(dept.id)}
                                className="rounded"
                              />
                              {dept.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Initial password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={creating || (formData.role === 'manager' && formData.departmentIds.length === 0) || (formData.role === 'employee' && !formData.department)}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create User
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">{users.filter(u => u.status === 'active').length}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold text-red-600">{users.filter(u => u.status === 'inactive').length}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-red-500" />
              </div>
            </div>
          </div>

          {/* User List */}
          <div className="border rounded-lg">
            <div className="p-4 border-b flex items-center justify-between gap-4">
              <h2 className="font-semibold">Users</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchTerm ? 'No users match your search' : 'No users found'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 text-sm font-medium">Employee</th>
                      <th className="text-left py-3 px-4 text-sm font-medium hidden md:table-cell">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium hidden lg:table-cell">Department</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{user.employeeId}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell text-sm text-muted-foreground">
                          {user.email}
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell text-sm">
                          {user.department}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            user.role === 'superadmin' ? 'role-superadmin' :
                            user.role === 'admin' ? 'role-admin' :
                            user.role === 'manager' ? 'role-manager' : 'role-employee'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            user.status === 'active' ? 'status-active' : 'status-inactive'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => openEditModal(user)}
                              title="Edit user"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {session?.role === 'superadmin' && user.status === 'active' && user.id !== session.id && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeactivateUser(user.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Edit User</h2>
                <p className="text-sm text-muted-foreground">
                  {editingUser.employeeId} - {editingUser.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateUser} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="John Doe"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    required
                  />
                </div>
                
                {session?.role === 'superadmin' && (
                  <>
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={editFormData.role}
                        onChange={(e) => setEditFormData({ 
                          ...editFormData, 
                          role: e.target.value as 'employee' | 'manager' | 'teamhead' | 'admin' | 'boardmember',
                        })}
                        required
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="teamhead">Team Head</option>
                        <option value="boardmember">Board Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status *</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={editFormData.status}
                        onChange={(e) => setEditFormData({ 
                          ...editFormData, 
                          status: e.target.value as 'active' | 'inactive',
                        })}
                        required
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </>
                )}
                
                {/* Department - Single select for employees only */}
                  {editFormData.role === 'employee' && (
                    <div className="space-y-2">
                      <Label>Department *</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={editFormData.department}
                        onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                        required
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.name}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                {/* Admin info message */}
                {editFormData.role === 'admin' && (
                  <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Admins have administrative access. Department assignment is not required.
                    </p>
                  </div>
                )}

                {/* Board member info message */}
                {editFormData.role === 'boardmember' && (
                  <div className="col-span-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Board Members have access across all departments, entities, and branches.
                    </p>
                  </div>
                )}

                {/* Departments - Multi select for managers */}
                {editFormData.role === 'manager' && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Departments * (Select multiple)</Label>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                      {departments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No departments available.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {departments.map((dept) => (
                            <label
                              key={dept.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                                editFormData.departmentIds.includes(dept.id)
                                  ? 'bg-primary/10 border border-primary'
                                  : 'bg-muted/50 hover:bg-muted'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editFormData.departmentIds.includes(dept.id)}
                                onChange={() => handleEditDepartmentToggle(dept.id)}
                                className="rounded"
                              />
                              {dept.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Password Section */}
                <div className="sm:col-span-2 border-t pt-4 mt-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-base font-semibold">Password Management</Label>
                      <p className="text-sm text-muted-foreground">Reset or change user password</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetPassword}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Quick Reset
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>New Password (leave empty to keep current)</Label>
                    <Input
                      type="password"
                      placeholder="Enter new password"
                      value={editFormData.password}
                      onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Only fill this if you want to change the password
                    </p>
                  </div>
                </div>

                <div className="sm:col-span-2 flex gap-4 pt-4 border-t">
                  <Button 
                    type="submit" 
                    disabled={updatingUser || (editFormData.role === 'manager' && editFormData.departmentIds.length === 0)}
                  >
                    {updatingUser ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Changes
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg border">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Bulk Upload Users</h2>
                <p className="text-sm text-muted-foreground">
                  Upload multiple users at once using CSV or JSON format
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={closeBulkUploadModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              {/* Step 1: Select Format */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Step 1: Select File Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkUploadFormat('csv');
                      setTemplateDownloaded(false);
                      setBulkUploadFile(null);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      bulkUploadFormat === 'csv'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <FileSpreadsheet className={`h-8 w-8 ${bulkUploadFormat === 'csv' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-medium ${bulkUploadFormat === 'csv' ? 'text-primary' : ''}`}>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkUploadFormat('json');
                      setTemplateDownloaded(false);
                      setBulkUploadFile(null);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      bulkUploadFormat === 'json'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <FileJson className={`h-8 w-8 ${bulkUploadFormat === 'json' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-medium ${bulkUploadFormat === 'json' ? 'text-primary' : ''}`}>JSON</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Download Template */}
              {bulkUploadFormat && (
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    Step 2: Download Template
                    {templateDownloaded && <Check className="h-4 w-4 text-green-500" />}
                  </label>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm text-muted-foreground mb-3">
                      Download the template file, fill in your user data, then upload it below.
                    </p>
                    <Button
                      variant={templateDownloaded ? "outline" : "default"}
                      size="sm"
                      onClick={() => downloadTemplate(bulkUploadFormat)}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {templateDownloaded ? 'Download Again' : `Download ${bulkUploadFormat.toUpperCase()} Template`}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Columns:</strong> employeeId, name, email, password, role, departmentName</p>
                    <p><strong>Valid roles:</strong> employee, manager, boardmember{session?.role === 'superadmin' ? ', admin' : ''}</p>
                    <p><strong>Boardmember{session?.role === 'superadmin' ? '/Admin' : ''}:</strong> Leave departmentName empty</p>
                    <p><strong>Manager with multiple depts:</strong> Use <code className="bg-muted px-1 rounded">|</code> separator (e.g., <code className="bg-muted px-1 rounded">Graphics|Websites</code>)</p>
                  </div>
                </div>
              )}

              {/* Step 3: Upload File */}
              {bulkUploadFormat && templateDownloaded && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Step 3: Upload Your File</label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept={bulkUploadFormat === 'csv' ? '.csv' : '.json'}
                      onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="bulk-upload-file-admin"
                    />
                    <label
                      htmlFor="bulk-upload-file-admin"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      {bulkUploadFile ? (
                        <span className="text-sm font-medium text-primary">{bulkUploadFile.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Click to select {bulkUploadFormat.toUpperCase()} file
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={closeBulkUploadModal}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkUpload}
                  disabled={!bulkUploadFile || bulkUploading}
                  className="flex-1"
                >
                  {bulkUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Users
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmAction) {
                  confirmAction();
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
