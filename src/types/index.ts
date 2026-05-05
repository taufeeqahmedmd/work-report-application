// User roles
export type UserRole = 'employee' | 'manager' | 'teamhead' | 'admin' | 'superadmin' | 'boardmember';

// User status
export type UserStatus = 'active' | 'inactive';

// Work report status
export type WorkStatus = 'working' | 'leave' | 'absent';

// Entity type
export interface Entity {
  id: number;
  name: string;
  createdAt: string;
}

// Branch type
export interface Branch {
  id: number;
  name: string;
  entityId: number;
  createdAt: string;
}

// Department type
export interface Department {
  id: number;
  name: string;
  entityId: number | null;
  createdAt: string;
}

// Manager Department mapping
export interface ManagerDepartment {
  id: number;
  managerId: number;
  departmentId: number;
  createdAt: string;
}

// Employee type (used for authentication and user management)
export interface Employee {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  password: string;
  entityId: number | null;
  branchId: number | null;
  role: UserRole;
  status: UserStatus;
  pageAccess: string | null; // JSON string of PageAccess
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// Employee without password (for client-side use)
export interface SafeEmployee {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  entityId: number | null;
  branchId: number | null;
  role: UserRole;
  status: UserStatus;
  pageAccess: PageAccess | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// Work report type
export interface WorkReport {
  id: number;
  employeeId: string;
  date: string;
  name: string;
  email: string;
  department: string;
  status: WorkStatus;
  workReport: string | null;
  onDuty: boolean;
  halfday: boolean;
  createdAt: string;
}

/** Super-admin CSV export row (employee org columns from join) */
export interface WorkReportExportRow extends WorkReport {
  entityName: string | null;
  branchName: string | null;
}

// Password reset token type
export interface PasswordResetToken {
  id: number;
  employeeId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// Holiday type
export interface Holiday {
  id: number;
  date: string; // YYYY-MM-DD format
  name: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// Session user type (for JWT payload)
export interface SessionUser {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  entityId: number | null;
  branchId: number | null;
  pageAccess: PageAccess | null;
}

// Login credentials
export interface LoginCredentials {
  employeeId: string;
  password: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Create employee input
export interface CreateEmployeeInput {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  password: string;
  entityId?: number | null;
  branchId?: number | null;
  role?: UserRole;
  pageAccess?: PageAccess | null;
  createdBy?: number | null;
}

// Update employee input
export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  department?: string;
  password?: string;
  entityId?: number | null;
  branchId?: number | null;
  role?: UserRole;
  status?: UserStatus;
  pageAccess?: PageAccess | null;
}

// Create work report input
export interface CreateWorkReportInput {
  employeeId: string;
  date: string;
  name: string;
  email: string;
  department: string;
  status: WorkStatus;
  workReport?: string | null;
  onDuty?: boolean;
  halfday?: boolean;
}

// Update work report input
export interface UpdateWorkReportInput {
  status?: WorkStatus;
  workReport?: string | null;
  onDuty?: boolean;
  halfday?: boolean;
}

// Create entity input
export interface CreateEntityInput {
  name: string;
}

// Create branch input
export interface CreateBranchInput {
  name: string;
  entityId: number;
}

// Create department input
export interface CreateDepartmentInput {
  name: string;
  entityId?: number | null;
}

// Setting type for system configuration
export interface Setting {
  id: number;
  key: string;
  value: string;
  updatedAt: string;
}

// Edit permissions settings
export interface EditPermissions {
  employee_can_edit_own_reports: boolean;
  manager_can_edit_team_reports: boolean;
  admin_can_edit_reports: boolean;
  superadmin_can_edit_reports: boolean;
}

// Page access permissions for roles
export interface PageAccess {
  dashboard: boolean;
  submit_report: boolean;
  employee_reports: boolean;
  management_dashboard: boolean;
  admin_dashboard: boolean;
  super_admin_dashboard: boolean;
  mark_attendance: boolean; // Permission to mark employees as absent
  mark_holidays: boolean; // Permission to mark holidays (for Operations department)
}

// Default page access by role
export const DEFAULT_PAGE_ACCESS: Record<UserRole, PageAccess> = {
  employee: {
    dashboard: true,
    submit_report: true,
    employee_reports: false,
    management_dashboard: false,
    admin_dashboard: false,
    super_admin_dashboard: false,
    mark_attendance: false,
    mark_holidays: false,
  },
  manager: {
    dashboard: true,
    submit_report: true,
    employee_reports: true,
    management_dashboard: true,
    admin_dashboard: false,
    super_admin_dashboard: false,
    mark_attendance: true, // Managers can mark attendance by default
    mark_holidays: true, // Managers can mark holidays by default
  },
  teamhead: {
    dashboard: true,
    submit_report: true,
    employee_reports: true,
    management_dashboard: true,
    admin_dashboard: false,
    super_admin_dashboard: false,
    mark_attendance: true,
    mark_holidays: true,
  },
  boardmember: {
    dashboard: true,
    submit_report: false,
    employee_reports: true,
    management_dashboard: true,
    admin_dashboard: false,
    super_admin_dashboard: false,
    mark_attendance: false,
    mark_holidays: false,
  },
  admin: {
    dashboard: true,
    submit_report: true,
    employee_reports: false,  // Not by default, can be granted by super admin
    management_dashboard: false,  // Not by default, can be granted by super admin
    admin_dashboard: true,
    super_admin_dashboard: false,
    mark_attendance: false,  // Not by default, can be granted by super admin
    mark_holidays: true, // Admins can mark holidays by default
  },
  superadmin: {
    dashboard: true,
    submit_report: true,
    employee_reports: false,  // Not by default, can be configured
    management_dashboard: false,  // Not by default, can be configured
    admin_dashboard: true,
    super_admin_dashboard: true,
    mark_attendance: false,  // Not by default, can be configured
    mark_holidays: true, // Super admins can mark holidays by default
  },
};

// Employee lookup result (for work report form)
export interface EmployeeLookup {
  employeeId: string;
  name: string;
  email: string;
  department: string;
}

