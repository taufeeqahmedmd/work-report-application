'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Building2, GitBranch, Users, Search, Trash2, UserX, UserCheck, FolderTree, X, Pencil, Key, Settings, Shield, Upload, Download, FileJson, FileSpreadsheet, Check, Bell, CircleHelp, Activity, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { SafeEmployee, Entity, Branch, Department, EditPermissions, PageAccess } from '@/types';
import { DEFAULT_PAGE_ACCESS } from '@/types';

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SafeEmployee[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // User list filters
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Entity form
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [entityName, setEntityName] = useState('');
  const [creatingEntity, setCreatingEntity] = useState(false);

  // Branch form
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<number | ''>('');
  const [creatingBranch, setCreatingBranch] = useState(false);

  // Department form
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [selectedDeptEntityId, setSelectedDeptEntityId] = useState<number | ''>('');
  const [creatingDepartment, setCreatingDepartment] = useState(false);

  // User form
  const [showUserForm, setShowUserForm] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    department: '',
    departmentIds: [] as number[], // For managers - multiple departments
    password: '',
    entityId: '' as number | '',
    branchId: '' as number | '',
    role: 'employee' as 'employee' | 'manager' | 'teamhead' | 'admin' | 'superadmin' | 'boardmember',
  });
  const [userPageAccess, setUserPageAccess] = useState<PageAccess>(DEFAULT_PAGE_ACCESS.employee);

  // Edit user form
  const [editingUser, setEditingUser] = useState<SafeEmployee | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    department: '',
    departmentIds: [] as number[],
    password: '', // Leave empty to keep existing password
    entityId: '' as number | '',
    branchId: '' as number | '',
    role: 'employee' as 'employee' | 'manager' | 'teamhead' | 'admin' | 'superadmin' | 'boardmember',
    status: 'active' as 'active' | 'inactive',
  });
  const [editPageAccess, setEditPageAccess] = useState<PageAccess>(DEFAULT_PAGE_ACCESS.employee);

  // Edit permissions settings
  const [editPermissions, setEditPermissions] = useState<EditPermissions>({
    employee_can_edit_own_reports: false,
    manager_can_edit_team_reports: true,
    admin_can_edit_reports: true,
    superadmin_can_edit_reports: true,
  });
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Bulk upload
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFormat, setBulkUploadFormat] = useState<'csv' | 'json' | null>(null);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);

  // Work report CSV export (super-admin)
  const [exportAllDates, setExportAllDates] = useState(false);
  const [exportEntityId, setExportEntityId] = useState<string>('all');
  const [exportBranchId, setExportBranchId] = useState<string>('all');
  const [exportDepartment, setExportDepartment] = useState<string>('all');
  const [exportStatus, setExportStatus] = useState<string>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportingReports, setExportingReports] = useState(false);

  const exportBranchesFiltered = useMemo(() => {
    if (exportEntityId === 'all') return branches;
    return branches.filter((b) => b.entityId === Number(exportEntityId));
  }, [branches, exportEntityId]);

  const exportDepartmentOptions = useMemo(() => {
    let list = departments;
    if (exportEntityId !== 'all') {
      const eid = Number(exportEntityId);
      list = departments.filter((d) => d.entityId === eid || d.entityId == null);
    }
    return [...new Set(list.map((d) => d.name))].sort((a, b) => a.localeCompare(b));
  }, [departments, exportEntityId]);

  useEffect(() => {
    setExportBranchId('all');
  }, [exportEntityId]);

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, entitiesRes, branchesRes, departmentsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/entities'),
        fetch('/api/admin/branches'),
        fetch('/api/admin/departments'),
        fetch('/api/admin/settings'),
      ]);

      const [usersData, entitiesData, branchesData, departmentsData, settingsData] = await Promise.all([
        usersRes.json(),
        entitiesRes.json(),
        branchesRes.json(),
        departmentsRes.json(),
        settingsRes.json(),
      ]);

      if (usersData.success) setUsers(usersData.data || []);
      if (entitiesData.success) setEntities(entitiesData.data || []);
      if (branchesData.success) setBranches(branchesData.data || []);
      if (departmentsData.success) setDepartments(departmentsData.data || []);
      if (settingsData.success) setEditPermissions(settingsData.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingEntity(true);

    try {
      const response = await fetch('/api/admin/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: entityName }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Entity created successfully');
        setEntityName('');
        setShowEntityForm(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create entity');
      }
    } catch (error) {
      console.error('Failed to create entity:', error);
      toast.error('Failed to create entity');
    } finally {
      setCreatingEntity(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBranch(true);

    try {
      const response = await fetch('/api/admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: branchName, entityId: selectedEntityId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Branch created successfully');
        setBranchName('');
        setSelectedEntityId('');
        setShowBranchForm(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create branch');
      }
    } catch (error) {
      console.error('Failed to create branch:', error);
      toast.error('Failed to create branch');
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingDepartment(true);

    try {
      const response = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: departmentName, entityId: selectedDeptEntityId || null }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Department created successfully');
        setDepartmentName('');
        setSelectedDeptEntityId('');
        setShowDepartmentForm(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create department');
      }
    } catch (error) {
      console.error('Failed to create department:', error);
      toast.error('Failed to create department');
    } finally {
      setCreatingDepartment(false);
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
      const response = await fetch(`/api/admin/departments/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Department deleted successfully');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete department');
      }
    } catch (error) {
      console.error('Failed to delete department:', error);
      toast.error('Failed to delete department');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show confirmation dialog
    setConfirmTitle('Create User');
    setConfirmMessage('Are you sure you want to create this user with the specified permissions and settings?');
    setConfirmAction(() => async () => {
      setShowConfirmDialog(false);
      await performCreateUser();
    });
    setShowConfirmDialog(true);
  };

  const performCreateUser = async () => {
    setCreatingUser(true);

    try {
      // Determine department based on role
      let primaryDepartment = userFormData.department;
      if (userFormData.role === 'manager' && userFormData.departmentIds.length > 0) {
        // For managers, use first selected department as primary
        primaryDepartment = departments.find(d => d.id === userFormData.departmentIds[0])?.name || userFormData.department;
      } else if (userFormData.department === 'Operations' && userFormData.departmentIds.length > 0) {
        // For Operations users, use first selected department as primary (but keep Operations as department)
        primaryDepartment = 'Operations';
      } else if (userFormData.role === 'boardmember') {
        // Board members have access across all - set department as "Board"
        primaryDepartment = 'Board';
      } else if (userFormData.role === 'admin') {
        // Admins don't need department
        primaryDepartment = 'Admin';
      } else if (userFormData.role === 'superadmin') {
        // Super Admins don't need department
        primaryDepartment = 'Super Admin';
      }

      // Send pageAccess for all roles (employees can have mark_attendance permission)
      const pageAccessToSend = userPageAccess;

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userFormData,
          department: primaryDepartment,
          entityId: (userFormData.role === 'boardmember' || userFormData.role === 'superadmin') ? null : (userFormData.entityId || null),
          branchId: (userFormData.role === 'boardmember' || userFormData.role === 'superadmin') ? null : (userFormData.branchId || null),
          pageAccess: pageAccessToSend,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // If manager or Operations user, set their departments
        if ((userFormData.role === 'manager' || userFormData.department === 'Operations') && userFormData.departmentIds.length > 0) {
          await fetch(`/api/admin/users/${data.data.id}/departments`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ departmentIds: userFormData.departmentIds }),
          });
        }

        toast.success('User created successfully');
        setUserFormData({
          employeeId: '',
          name: '',
          email: '',
          department: '',
          departmentIds: [],
          password: '',
          entityId: '',
          branchId: '',
          role: 'employee',
        });
        setUserPageAccess(DEFAULT_PAGE_ACCESS.employee);
        setShowUserForm(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error('Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`User ${action}d successfully`);
        fetchData();
      } else {
        toast.error(data.error || `Failed to ${action} user`);
      }
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      toast.error(`Failed to ${action} user`);
    }
  };

  const handleDepartmentToggle = (deptId: number) => {
    setUserFormData(prev => ({
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
      entityId: user.entityId || '',
      branchId: user.branchId || '',
      role: user.role,
      status: user.status,
    });
    
    // Set page access from user or defaults - merge to ensure all fields are present
    if (user.pageAccess) {
      // Merge saved pageAccess with defaults to ensure all fields are present
      setEditPageAccess({
        ...DEFAULT_PAGE_ACCESS[user.role],
        ...user.pageAccess,
      });
    } else {
      setEditPageAccess(DEFAULT_PAGE_ACCESS[user.role]);
    }

    // If user is a manager or Operations department, fetch their departments
    if (user.role === 'manager' || user.department === 'Operations') {
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
        console.error('Failed to fetch user departments:', error);
      }
    }

    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Show confirmation dialog
    setConfirmTitle('Update User');
    setConfirmMessage(`Are you sure you want to save the changes for ${editingUser.name}? This will update their permissions and settings.`);
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
      // Build update payload - only include changed fields
      const updatePayload: Record<string, unknown> = {};
      
      if (editFormData.name !== editingUser.name) updatePayload.name = editFormData.name;
      if (editFormData.email !== editingUser.email) updatePayload.email = editFormData.email;
      if (editFormData.department !== editingUser.department) updatePayload.department = editFormData.department;
      if (editFormData.password) updatePayload.password = editFormData.password; // Only if new password provided
      if (editFormData.entityId !== (editingUser.entityId || '')) updatePayload.entityId = editFormData.entityId || null;
      if (editFormData.branchId !== (editingUser.branchId || '')) updatePayload.branchId = editFormData.branchId || null;
      if (editFormData.role !== editingUser.role) updatePayload.role = editFormData.role;
      if (editFormData.status !== editingUser.status) updatePayload.status = editFormData.status;

      // Always include page access - compare with original to ensure we save changes
      const originalPageAccess = editingUser.pageAccess || DEFAULT_PAGE_ACCESS[editingUser.role];
      const pageAccessChanged = JSON.stringify(originalPageAccess) !== JSON.stringify(editPageAccess);
      
      // Always send pageAccess to ensure it's saved (even if it matches, to handle null cases)
      updatePayload.pageAccess = editPageAccess;

      // For manager, update department to primary selected
      if (editFormData.role === 'manager' && editFormData.departmentIds.length > 0) {
        const primaryDept = departments.find(d => d.id === editFormData.departmentIds[0]);
        if (primaryDept) updatePayload.department = primaryDept.name;
      }
      
      // For Operations users, keep Operations as department
      if (editFormData.department === 'Operations') {
        updatePayload.department = 'Operations';
      }

      // For board members, set department to "Board" and clear entity/branch
      if (editFormData.role === 'boardmember') {
        updatePayload.department = 'Board';
        updatePayload.entityId = null;
        updatePayload.branchId = null;
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const data = await response.json();

      if (data.success) {
        // If manager or Operations user, update their departments (even if empty to clear them)
        if (editFormData.role === 'manager' || editFormData.department === 'Operations') {
          await fetch(`/api/admin/users/${editingUser.id}/departments`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ departmentIds: editFormData.departmentIds }),
          });
        }

        // Update the user in the local state with the response data to ensure latest pageAccess is reflected
        if (data.data) {
          const updatedUser = data.data as SafeEmployee;
          setUsers(prevUsers => 
            prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u)
          );
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

  const handlePermissionToggle = async (key: keyof EditPermissions) => {
    setSavingPermissions(true);
    const newValue = !editPermissions[key];
    
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      const data = await response.json();

      if (data.success) {
        setEditPermissions(data.data);
        toast.success('Permission updated successfully');
      } else {
        toast.error(data.error || 'Failed to update permission');
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      toast.error('Failed to update permission');
    } finally {
      setSavingPermissions(false);
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
        entityName: 'K-innovative',
        branchName: 'Kinn',
        departmentName: 'Websites',
      },
      {
        employeeId: 'EMP002',
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'manager',
        entityName: 'K-innovative',
        branchName: 'Kinn',
        departmentName: 'Graphics|Websites|Social Media', // Use | for multiple departments
      },
      {
        employeeId: 'EMP003',
        name: 'Board Member',
        email: 'board@example.com',
        password: 'password123',
        role: 'boardmember',
        entityName: '', // Leave empty for boardmember
        branchName: '',  // Leave empty for boardmember
        departmentName: '', // Leave empty for boardmember
      },
      {
        employeeId: 'EMP004',
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        entityName: 'K-innovative', // Admin needs entity
        branchName: 'Kinn',
        departmentName: '', // Leave empty for admin
      },
      {
        employeeId: 'EMP005',
        name: 'Super Admin',
        email: 'super@example.com',
        password: 'password123',
        role: 'superadmin',
        entityName: '', // Leave empty for superadmin
        branchName: '',  // Leave empty for superadmin
        departmentName: '', // Leave empty for superadmin
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
      // CSV format
      const headers = ['employeeId', 'name', 'email', 'password', 'role', 'entityName', 'branchName', 'departmentName'];
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
    if (!bulkUploadFile || !bulkUploadFormat) return;

    setBulkUploading(true);
    try {
      const fileContent = await bulkUploadFile.text();
      let usersData: Array<{
        employeeId: string;
        name: string;
        email: string;
        password: string;
        role: string;
        entityName: string;
        branchName: string;
        departmentName: string;
      }>;

      if (bulkUploadFormat === 'json') {
        usersData = JSON.parse(fileContent);
      } else {
        // Parse CSV
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

      // Validate and create users
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const userData of usersData) {
        try {
          const role = userData.role?.toLowerCase() || 'employee';
          
          // Handle boardmember - they don't need entity/branch/department
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

          // Handle superadmin - they don't need entity/branch/department
          if (role === 'superadmin') {
            const response = await fetch('/api/admin/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: userData.employeeId,
                name: userData.name,
                email: userData.email,
                password: userData.password,
                role: 'superadmin',
                entityId: null,
                branchId: null,
                department: 'Super Admin',
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

          // Handle admin - they need entity but not department
          if (role === 'admin') {
            const entity = entities.find(e => e.name.toLowerCase() === userData.entityName?.toLowerCase());
            const branch = branches.find(b => b.name.toLowerCase() === userData.branchName?.toLowerCase() && b.entityId === entity?.id);

            if (!entity) {
              errors.push(`${userData.employeeId}: Entity "${userData.entityName}" not found`);
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
                entityId: entity?.id || null,
                branchId: branch?.id || null,
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

          // For other roles, validate entity
          const entity = entities.find(e => e.name.toLowerCase() === userData.entityName?.toLowerCase());
          const branch = branches.find(b => b.name.toLowerCase() === userData.branchName?.toLowerCase() && b.entityId === entity?.id);

          if (!entity) {
            errors.push(`${userData.employeeId}: Entity "${userData.entityName}" not found`);
            errorCount++;
            continue;
          }

          if (userData.branchName && !branch) {
            errors.push(`${userData.employeeId}: Branch "${userData.branchName}" not found in entity "${userData.entityName}"`);
            errorCount++;
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
            departments.find(d => d.name.toLowerCase() === deptName.toLowerCase() && d.entityId === entity?.id)
          );

          const missingDepts = departmentNames.filter((name, idx) => !foundDepartments[idx]);
          if (missingDepts.length > 0) {
            errors.push(`${userData.employeeId}: Department(s) "${missingDepts.join(', ')}" not found in entity "${userData.entityName}"`);
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
              entityId: entity?.id || null,
              branchId: branch?.id || null,
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

      // Reset and close modal
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

  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = searchTerm === '' || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Role filter
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    // Entity filter
    const matchesEntity = filterEntity === 'all' || 
      (user.entityId && user.entityId.toString() === filterEntity) ||
      (filterEntity === 'none' && !user.entityId);
    
    // Status filter
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesEntity && matchesStatus;
  });

  const clearUserFilters = () => {
    setSearchTerm('');
    setFilterRole('all');
    setFilterEntity('all');
    setFilterStatus('all');
  };

  const hasActiveUserFilters = searchTerm !== '' || filterRole !== 'all' || filterEntity !== 'all' || filterStatus !== 'all';

  const getEntityName = (entityId: number | null) => {
    if (!entityId) return '-';
    return entities.find(e => e.id === entityId)?.name || '-';
  };

  const getBranchName = (branchId: number | null) => {
    if (!branchId) return '-';
    return branches.find(b => b.id === branchId)?.name || '-';
  };

  const handleExportWorkReports = async () => {
    if (!exportAllDates && (!exportStartDate || !exportEndDate)) {
      toast.error('Choose a start and end date, or enable full export (all dates).');
      return;
    }
    setExportingReports(true);
    try {
      const params = new URLSearchParams();
      if (exportAllDates) {
        params.set('allDates', 'true');
      } else {
        params.set('startDate', exportStartDate);
        params.set('endDate', exportEndDate);
      }
      if (exportEntityId !== 'all') params.set('entityId', exportEntityId);
      if (exportBranchId !== 'all') params.set('branchId', exportBranchId);
      if (exportDepartment !== 'all') params.set('department', exportDepartment);
      if (exportStatus !== 'all') params.set('status', exportStatus);

      const res = await fetch(`/api/admin/work-reports/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        toast.error(err.error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition');
      let fname = 'work-reports-export.csv';
      if (dispo) {
        const m = /filename="([^"]+)"/.exec(dispo);
        if (m) fname = m[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error(error);
      toast.error('Export failed');
    } finally {
      setExportingReports(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 bg-background overflow-x-hidden">
      <div className="px-3 sm:px-4 md:px-6 py-4">
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:flex lg:flex-col rounded-md border border-primary/30 bg-primary text-primary-foreground overflow-hidden min-h-[calc(100vh-7.5rem)]">
          <div className="px-5 py-4 border-b border-primary-foreground/10">
            <h2 className="text-2xl font-semibold leading-none">Work Report</h2>
            <p className="text-[11px] mt-1 uppercase tracking-[0.08em] text-primary-foreground/70">Enterprise Analytics</p>
          </div>
          <nav className="px-2 py-3 space-y-1">
            <Link href="/employee-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
              <Activity className="h-4 w-4" /> Dashboard
            </Link>
            <Link href="/employee-reports" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
              <FileText className="h-4 w-4" /> Reports
            </Link>
            <Link href="/manage-team" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
              <Users className="h-4 w-4" /> Team Management
            </Link>
            <Link href="/management-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
              <Activity className="h-4 w-4" /> Analytics
            </Link>
            <Link href="/super-admin" className="flex items-center gap-3 rounded-sm bg-primary-foreground/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em]">
              <Shield className="h-4 w-4" /> Admin Portal
            </Link>
          </nav>
        </aside>

      <main className="max-w-7xl mx-auto w-full">
        <div className="rounded-md border bg-card px-4 py-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold tracking-[-0.01em]">Work Report Application</h1>
              <div className="relative min-w-[260px] hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search system entities..."
                  className="pl-9 h-9 bg-muted/30 border-0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Bell className="h-4 w-4" /></button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><CircleHelp className="h-4 w-4" /></button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-muted-foreground"><Settings className="h-4 w-4" /></button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.06em]">Super Administrator</p>
              </div>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">System Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Global administrative control and organizational performance overview.
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entities</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entities.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Branches</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branches.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <FolderTree className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{departments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Permissions Settings */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Work Report Edit Permissions</CardTitle>
                <CardDescription>Control who can edit work reports in the system</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Employee Permission */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Employees</p>
                    <p className="text-xs text-muted-foreground">Edit own reports</p>
                  </div>
                </div>
                <button
                  onClick={() => handlePermissionToggle('employee_can_edit_own_reports')}
                  disabled={savingPermissions}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    editPermissions.employee_can_edit_own_reports ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editPermissions.employee_can_edit_own_reports ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Manager Permission */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Managers</p>
                    <p className="text-xs text-muted-foreground">Edit team reports</p>
                  </div>
                </div>
                <button
                  onClick={() => handlePermissionToggle('manager_can_edit_team_reports')}
                  disabled={savingPermissions}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    editPermissions.manager_can_edit_team_reports ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editPermissions.manager_can_edit_team_reports ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Admin Permission */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Admins</p>
                    <p className="text-xs text-muted-foreground">Edit all reports</p>
                  </div>
                </div>
                <button
                  onClick={() => handlePermissionToggle('admin_can_edit_reports')}
                  disabled={savingPermissions}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    editPermissions.admin_can_edit_reports ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editPermissions.admin_can_edit_reports ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Super Admin Permission */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Super Admin</p>
                    <p className="text-xs text-muted-foreground">Edit all reports</p>
                  </div>
                </div>
                <button
                  onClick={() => handlePermissionToggle('superadmin_can_edit_reports')}
                  disabled={savingPermissions}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    editPermissions.superadmin_can_edit_reports ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editPermissions.superadmin_can_edit_reports ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export work reports */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <CardTitle>Export work reports</CardTitle>
                  <CardDescription>
                    Download CSV (opens in Excel). Use filters for a subset, or full export for all dates (up to 100,000 rows).
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 sm:p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-input"
                checked={exportAllDates}
                onChange={(e) => setExportAllDates(e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium">Full export (all dates)</p>
                <p className="text-xs text-muted-foreground">
                  When checked, date fields are ignored. Narrow with entity, branch, department, or status if needed.
                </p>
              </div>
            </label>

            {!exportAllDates && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="export-start">Start date</Label>
                  <Input
                    id="export-start"
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-end">End date</Label>
                  <Input
                    id="export-end"
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full min-w-0"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Entity</Label>
                <select
                  className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={exportEntityId}
                  onChange={(e) => setExportEntityId(e.target.value)}
                >
                  <option value="all">All entities</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <select
                  className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={exportBranchId}
                  onChange={(e) => setExportBranchId(e.target.value)}
                >
                  <option value="all">All branches</option>
                  {exportBranchesFiltered.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={exportDepartment}
                  onChange={(e) => setExportDepartment(e.target.value)}
                >
                  <option value="all">All departments</option>
                  {exportDepartmentOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={exportStatus}
                  onChange={(e) => setExportStatus(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="working">Working</option>
                  <option value="leave">Leave</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            <Button onClick={handleExportWorkReports} disabled={exportingReports} className="w-full sm:w-auto">
              {exportingReports ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Button onClick={() => setShowEntityForm(!showEntityForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Entity
          </Button>
          <Button onClick={() => setShowBranchForm(!showBranchForm)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Branch
          </Button>
          <Button onClick={() => setShowDepartmentForm(!showDepartmentForm)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Department
          </Button>
          <Button onClick={() => setShowUserForm(!showUserForm)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </Button>
          <Button onClick={() => setShowBulkUploadModal(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload Users
          </Button>
        </div>

        {/* Entity Form */}
        {showEntityForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Entity</CardTitle>
              <CardDescription>Add a new entity to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEntity} className="flex gap-4">
                <Input
                  placeholder="Entity name"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  required
                  className="max-w-xs"
                />
                <Button type="submit" disabled={creatingEntity}>
                  {creatingEntity ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowEntityForm(false)}>
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Branch Form */}
        {showBranchForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Branch</CardTitle>
              <CardDescription>Add a new branch to an entity</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateBranch} className="flex gap-4 flex-wrap">
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value ? parseInt(e.target.value) : '')}
                  required
                >
                  <option value="">Select Entity</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
                <Input
                  placeholder="Branch name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                  className="max-w-xs"
                />
                <Button type="submit" disabled={creatingBranch}>
                  {creatingBranch ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowBranchForm(false)}>
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Department Form */}
        {showDepartmentForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Department</CardTitle>
              <CardDescription>Add a new department to an entity</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateDepartment} className="flex gap-4 flex-wrap">
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedDeptEntityId}
                  onChange={(e) => setSelectedDeptEntityId(e.target.value ? parseInt(e.target.value) : '')}
                  required
                >
                  <option value="">Select Entity</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
                <Input
                  placeholder="Department name"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  required
                  className="max-w-xs"
                />
                <Button type="submit" disabled={creatingDepartment}>
                  {creatingDepartment ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowDepartmentForm(false)}>
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* User Form */}
        {showUserForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New User</CardTitle>
              <CardDescription>Add a new user with full configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Employee ID *</Label>
                  <Input
                    placeholder="e.g., EMP001"
                    value={userFormData.employeeId}
                    onChange={(e) => setUserFormData({ ...userFormData, employeeId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="John Doe"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={userFormData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as 'employee' | 'manager' | 'teamhead' | 'admin' | 'superadmin' | 'boardmember';
                      setUserFormData({ 
                        ...userFormData, 
                        role: newRole,
                        department: '',
                        departmentIds: []
                      });
                      setUserPageAccess(DEFAULT_PAGE_ACCESS[newRole]);
                    }}
                    required
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="teamhead">Team Head</option>
                    <option value="boardmember">Board Member</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    placeholder="Initial password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    required
                  />
                </div>
                
                {/* Department - Single select for employees only */}
                {userFormData.role === 'employee' && (
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={userFormData.department}
                      onChange={(e) => {
                        setUserFormData({ 
                          ...userFormData, 
                          department: e.target.value,
                          // Clear departmentIds when changing department (unless selecting Operations)
                          departmentIds: e.target.value === 'Operations' ? userFormData.departmentIds : []
                        });
                      }}
                      required
                      disabled={!userFormData.entityId}
                    >
                      <option value="">{userFormData.entityId ? 'Select Department' : 'Select Entity first'}</option>
                      <option value="Operations">Operations</option>
                      {departments
                        .filter(d => d.entityId === userFormData.entityId)
                        .map((dept) => (
                          <option key={dept.id} value={dept.name}>{dept.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Admin/SuperAdmin info message */}
                {(userFormData.role === 'admin' || userFormData.role === 'superadmin') && (
                  <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {userFormData.role === 'superadmin' ? 'Super Admins' : 'Admins'} have administrative access. Department assignment is not required.
                    </p>
                  </div>
                )}

                {/* Board member info message */}
                {userFormData.role === 'boardmember' && (
                  <div className="md:col-span-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Board Members have access across all departments, entities, and branches. No department, entity, or branch assignment required.
                    </p>
                  </div>
                )}

                {/* Departments - Multi select for managers */}
                {userFormData.role === 'manager' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Departments * (Select multiple)</Label>
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                      {!userFormData.entityId ? (
                        <p className="text-sm text-muted-foreground">Select an entity first to see available departments.</p>
                      ) : departments.filter(d => d.entityId === userFormData.entityId).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No departments available for this entity. Create departments first.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {departments
                            .filter(d => d.entityId === userFormData.entityId)
                            .map((dept) => (
                              <label
                                key={dept.id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                  userFormData.departmentIds.includes(dept.id)
                                    ? 'bg-primary/10 border border-primary'
                                    : 'bg-muted/50 hover:bg-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={userFormData.departmentIds.includes(dept.id)}
                                  onChange={() => handleDepartmentToggle(dept.id)}
                                  className="rounded"
                                />
                                <span className="text-sm">{dept.name}</span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    {userFormData.departmentIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {userFormData.departmentIds.map(id => departments.find(d => d.id === id)?.name).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Departments - Multi select for Operations department users */}
                {userFormData.department === 'Operations' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Departments * (Select multiple - employees from these departments can be marked absent)</Label>
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                      {!userFormData.entityId ? (
                        <p className="text-sm text-muted-foreground">Select an entity first to see available departments.</p>
                      ) : departments.filter(d => d.entityId === userFormData.entityId).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No departments available for this entity. Create departments first.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {departments
                            .filter(d => d.entityId === userFormData.entityId)
                            .map((dept) => (
                              <label
                                key={dept.id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                  userFormData.departmentIds.includes(dept.id)
                                    ? 'bg-primary/10 border border-primary'
                                    : 'bg-muted/50 hover:bg-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={userFormData.departmentIds.includes(dept.id)}
                                  onChange={() => handleDepartmentToggle(dept.id)}
                                  className="rounded"
                                />
                                <span className="text-sm">{dept.name}</span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    {userFormData.departmentIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {userFormData.departmentIds.map(id => departments.find(d => d.id === id)?.name).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Page Access - Available for all roles */}
                <div className="space-y-3 md:col-span-2">
                    <Label className="text-sm font-medium">Page Access Permissions</Label>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.dashboard}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, dashboard: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Dashboard</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.submit_report}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, submit_report: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Submit Report</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.employee_reports}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, employee_reports: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Employee Reports</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.management_dashboard}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, management_dashboard: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Management Dashboard</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.admin_dashboard}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, admin_dashboard: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Admin Dashboard</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.super_admin_dashboard}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, super_admin_dashboard: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Super Admin Dashboard</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.mark_attendance}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, mark_attendance: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Mark Attendance</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userPageAccess.mark_holidays}
                            onChange={(e) => setUserPageAccess({ ...userPageAccess, mark_holidays: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Mark Holidays</span>
                        </label>
                      </div>
                    </div>
                  </div>

                {/* Entity and Branch - Not for board members */}
                {userFormData.role !== 'boardmember' && (
                  <>
                    <div className="space-y-2">
                      <Label>Entity *</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={userFormData.entityId}
                        onChange={(e) => setUserFormData({ 
                          ...userFormData, 
                          entityId: e.target.value ? parseInt(e.target.value) : '', 
                          branchId: '',
                          department: '',
                          departmentIds: []
                        })}
                        required
                      >
                        <option value="">Select Entity</option>
                        {entities.map((entity) => (
                          <option key={entity.id} value={entity.id}>{entity.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Branch</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={userFormData.branchId}
                        onChange={(e) => setUserFormData({ ...userFormData, branchId: e.target.value ? parseInt(e.target.value) : '' })}
                        disabled={!userFormData.entityId}
                      >
                        <option value="">No Branch</option>
                        {branches
                          .filter(b => b.entityId === userFormData.entityId)
                          .map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="md:col-span-2 flex gap-4">
                  <Button type="submit" disabled={creatingUser || (userFormData.role === 'manager' && userFormData.departmentIds.length === 0) || (userFormData.role === 'employee' && !userFormData.department)}>
                    {creatingUser ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Create User
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowUserForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Entities, Branches & Departments */}
        <div className="grid gap-8 md:grid-cols-3 mb-8">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Entities</CardTitle>
              <CardDescription>All entities in the system</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {entities.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No entities created yet</p>
              ) : (
                <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {entities.map((entity) => (
                    <li key={entity.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{entity.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {branches.filter(b => b.entityId === entity.id).length} branches
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Branches</CardTitle>
              <CardDescription>All branches in the system</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {branches.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No branches created yet</p>
              ) : (
                <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {branches.map((branch) => (
                    <li key={branch.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span>{branch.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {getEntityName(branch.entityId)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>All departments in the system</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {departments.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No departments created yet</p>
              ) : (
                <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {departments.map((dept) => (
                    <li key={dept.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span>{dept.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {getEntityName(dept.entityId)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteDepartment(dept.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Manage all users in the system ({filteredUsers.length} of {users.length})</CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="all">All Roles</option>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="teamhead">Team Head</option>
                  <option value="boardmember">Board Member</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
                
                <select
                  value={filterEntity}
                  onChange={(e) => setFilterEntity(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="all">All Entities</option>
                  <option value="none">No Entity</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                {hasActiveUserFilters && (
                  <Button variant="ghost" size="sm" onClick={clearUserFilters} className="h-9 text-muted-foreground">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No users match your search' : 'No users found'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Employee ID</th>
                      <th className="text-left py-3 px-4 font-medium">Name</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Department</th>
                      <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Entity</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="py-3 px-4 font-mono text-sm">{user.employeeId}</td>
                        <td className="py-3 px-4">{user.name}</td>
                        <td className="py-3 px-4 hidden md:table-cell text-sm">{user.department}</td>
                        <td className="py-3 px-4 hidden lg:table-cell text-sm">{getEntityName(user.entityId)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.role === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            user.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            user.role === 'manager' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
                            user.role === 'boardmember' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          }`}>
                            {user.role === 'boardmember' ? 'board member' : user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              title="Edit user"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleUserStatus(user.id, user.status)}
                              title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                            >
                              {user.status === 'active' ? (
                                <UserX className="h-4 w-4 text-destructive" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit User Modal */}
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Edit User</CardTitle>
                  <CardDescription>
                    Editing: {editingUser.employeeId} - {editingUser.name}
                  </CardDescription>
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
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateUser} className="grid gap-4 md:grid-cols-2">
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
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editFormData.role}
                      onChange={(e) => {
                        const newRole = e.target.value as 'employee' | 'manager' | 'teamhead' | 'admin' | 'superadmin' | 'boardmember';
                        setEditFormData({ 
                          ...editFormData, 
                          role: newRole,
                        });
                        setEditPageAccess(DEFAULT_PAGE_ACCESS[newRole]);
                      }}
                      required
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="teamhead">Team Head</option>
                      <option value="boardmember">Board Member</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
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
                  
                  {/* Department - Single select for employees only */}
                  {editFormData.role === 'employee' && (
                    <div className="space-y-2">
                      <Label>Department *</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={editFormData.department}
                        onChange={(e) => {
                          setEditFormData({ 
                            ...editFormData, 
                            department: e.target.value,
                            // Clear departmentIds when changing department (unless selecting Operations)
                            departmentIds: e.target.value === 'Operations' ? editFormData.departmentIds : []
                          });
                        }}
                        required
                        disabled={!editFormData.entityId}
                      >
                        <option value="">{editFormData.entityId ? 'Select Department' : 'Select Entity first'}</option>
                        <option value="Operations">Operations</option>
                        {departments
                          .filter(d => d.entityId === editFormData.entityId)
                          .map((dept) => (
                            <option key={dept.id} value={dept.name}>{dept.name}</option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Admin/SuperAdmin info message */}
                  {(editFormData.role === 'admin' || editFormData.role === 'superadmin') && (
                    <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {editFormData.role === 'superadmin' ? 'Super Admins' : 'Admins'} have administrative access. Department assignment is not required.
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
                    <div className="space-y-2 md:col-span-2">
                      <Label>Departments * (Select multiple)</Label>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                        {!editFormData.entityId ? (
                          <p className="text-sm text-muted-foreground">Select an entity first to see available departments.</p>
                        ) : departments.filter(d => d.entityId === editFormData.entityId).length === 0 ? (
                          <p className="text-sm text-muted-foreground">No departments available for this entity.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {departments
                              .filter(d => d.entityId === editFormData.entityId)
                              .map((dept) => (
                                <label
                                  key={dept.id}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
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
                                  <span className="text-sm">{dept.name}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                      {editFormData.departmentIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {editFormData.departmentIds.map(id => departments.find(d => d.id === id)?.name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Departments - Multi select for Operations department users */}
                  {editFormData.department === 'Operations' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Departments * (Select multiple - employees from these departments can be marked absent)</Label>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                        {!editFormData.entityId ? (
                          <p className="text-sm text-muted-foreground">Select an entity first to see available departments.</p>
                        ) : departments.filter(d => d.entityId === editFormData.entityId).length === 0 ? (
                          <p className="text-sm text-muted-foreground">No departments available for this entity.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {departments
                              .filter(d => d.entityId === editFormData.entityId)
                              .map((dept) => (
                                <label
                                  key={dept.id}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
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
                                  <span className="text-sm">{dept.name}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                      {editFormData.departmentIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {editFormData.departmentIds.map(id => departments.find(d => d.id === id)?.name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Page Access - Available for all roles */}
                  <div className="space-y-3 md:col-span-2">
                      <Label className="text-sm font-medium">Page Access Permissions</Label>
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.dashboard}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, dashboard: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Dashboard</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.submit_report}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, submit_report: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Submit Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.employee_reports}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, employee_reports: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Employee Reports</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.management_dashboard}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, management_dashboard: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Management Dashboard</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.admin_dashboard}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, admin_dashboard: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Admin Dashboard</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.super_admin_dashboard}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, super_admin_dashboard: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Super Admin Dashboard</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.mark_attendance}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, mark_attendance: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Mark Attendance</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPageAccess.mark_holidays}
                              onChange={(e) => setEditPageAccess({ ...editPageAccess, mark_holidays: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Mark Holidays</span>
                          </label>
                        </div>
                      </div>
                    </div>

                  {/* Entity and Branch - Not for board members */}
                  {editFormData.role !== 'boardmember' && (
                    <>
                      <div className="space-y-2">
                        <Label>Entity *</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={editFormData.entityId}
                          onChange={(e) => setEditFormData({ 
                            ...editFormData, 
                            entityId: e.target.value ? parseInt(e.target.value) : '', 
                            branchId: '',
                            department: '',
                            departmentIds: []
                          })}
                          required
                        >
                          <option value="">Select Entity</option>
                          {entities.map((entity) => (
                            <option key={entity.id} value={entity.id}>{entity.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={editFormData.branchId}
                          onChange={(e) => setEditFormData({ ...editFormData, branchId: e.target.value ? parseInt(e.target.value) : '' })}
                          disabled={!editFormData.entityId}
                        >
                          <option value="">No Branch</option>
                          {branches
                            .filter(b => b.entityId === editFormData.entityId)
                            .map((branch) => (
                              <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Password Section */}
                  <div className="md:col-span-2 border-t pt-4 mt-2">
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

                  <div className="md:col-span-2 flex gap-4 pt-4 border-t">
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bulk Upload Modal */}
        {showBulkUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Bulk Upload Users</CardTitle>
                  <CardDescription>
                    Upload multiple users at once using CSV or JSON format
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={closeBulkUploadModal}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step 1: Select Format */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Step 1: Select File Format</Label>
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
                    <Label className="text-sm font-medium flex items-center gap-2">
                      Step 2: Download Template
                      {templateDownloaded && <Check className="h-4 w-4 text-green-500" />}
                    </Label>
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
                      <p><strong>Columns:</strong> employeeId, name, email, password, role, entityName, branchName, departmentName</p>
                      <p><strong>Valid roles:</strong> employee, manager, admin, superadmin, boardmember</p>
                      <p><strong>Boardmember:</strong> Leave entityName, branchName, departmentName empty</p>
                      <p><strong>Manager with multiple depts:</strong> Use <code className="bg-muted px-1 rounded">|</code> separator (e.g., <code className="bg-muted px-1 rounded">Graphics|Websites|Social Media</code>)</p>
                    </div>
                  </div>
                )}

                {/* Step 3: Upload File */}
                {bulkUploadFormat && templateDownloaded && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Step 3: Upload Your File</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept={bulkUploadFormat === 'csv' ? '.csv' : '.json'}
                        onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="bulk-upload-file"
                      />
                      <label
                        htmlFor="bulk-upload-file"
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
              </CardContent>
            </Card>
          </div>
        )}
        </main>
      </div>
      </div>

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
