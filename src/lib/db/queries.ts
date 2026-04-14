import { eq, and, desc, like, inArray, sql, or, gte, lte } from 'drizzle-orm';
import { logger } from '../logger';
import { db, pool } from './database';
import {
  entities,
  branches,
  departments,
  employees,
  managerDepartments,
  workReports,
  passwordResetTokens,
  otpTokens,
  settings,
  holidays,
} from './schema';
import type {
  Employee as EmployeeType,
  SafeEmployee,
  Entity,
  Branch,
  Department,
  WorkReport,
  WorkReportExportRow,
  PasswordResetToken,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  CreateWorkReportInput,
  CreateEntityInput,
  CreateBranchInput,
  CreateDepartmentInput,
  EmployeeLookup,
  Setting,
  EditPermissions,
} from '@/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to safely convert timestamp to ISO string
 */
function toISOString(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  return value.toISOString();
}

/**
 * Convert database employee to application Employee type
 */
function toEmployee(row: typeof employees.$inferSelect): EmployeeType {
  return {
    id: row.id,
    employeeId: row.employeeId,
    name: row.name,
    email: row.email,
    department: row.department,
    password: row.password,
    entityId: row.entityId,
    branchId: row.branchId,
    role: row.role as EmployeeType['role'],
    status: row.status as EmployeeType['status'],
    pageAccess: row.pageAccess,
    createdBy: row.createdBy,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
  };
}

/**
 * Convert database employee to SafeEmployee (without password)
 */
function toSafeEmployee(row: typeof employees.$inferSelect): SafeEmployee {
  let pageAccess = null;
  if (row.pageAccess) {
    try {
      pageAccess = JSON.parse(row.pageAccess);
    } catch (error) {
      logger.error('Failed to parse pageAccess JSON:', error);
      pageAccess = null;
    }
  }
  
  return {
    id: row.id,
    employeeId: row.employeeId,
    name: row.name,
    email: row.email,
    department: row.department,
    entityId: row.entityId,
    branchId: row.branchId,
    role: row.role as SafeEmployee['role'],
    status: row.status as SafeEmployee['status'],
    pageAccess,
    createdBy: row.createdBy,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
  };
}

/**
 * Convert database work report to WorkReport type
 */
function toWorkReport(row: typeof workReports.$inferSelect): WorkReport {
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: row.date,
    name: row.name,
    email: row.email,
    department: row.department,
    status: row.status as WorkReport['status'],
    workReport: row.workReport,
    onDuty: row.onDuty,
    halfday: row.halfday,
    createdAt: toISOString(row.createdAt),
  };
}

/**
 * Convert database entity to Entity type
 */
function toEntity(row: typeof entities.$inferSelect): Entity {
  return {
    id: row.id,
    name: row.name,
    createdAt: toISOString(row.createdAt),
  };
}

/**
 * Convert database branch to Branch type
 */
function toBranch(row: typeof branches.$inferSelect): Branch {
  return {
    id: row.id,
    name: row.name,
    entityId: row.entityId,
    createdAt: toISOString(row.createdAt),
  };
}

/**
 * Convert database department to Department type
 */
function toDepartment(row: typeof departments.$inferSelect): Department {
  return {
    id: row.id,
    name: row.name,
    entityId: row.entityId,
    createdAt: toISOString(row.createdAt),
  };
}

// ============================================================================
// Employee Queries
// ============================================================================

/**
 * Get employee by ID (internal database id)
 */
export async function getEmployeeById(id: number): Promise<EmployeeType | null> {
  const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return result[0] ? toEmployee(result[0]) : null;
}

/**
 * Get employee by employeeId (the human-readable ID)
 * Case-insensitive lookup - accepts both uppercase and lowercase
 */
export async function getEmployeeByEmployeeId(employeeId: string): Promise<EmployeeType | null> {
  const result = await db
    .select()
    .from(employees)
    .where(sql`UPPER(${employees.employeeId}) = UPPER(${employeeId})`)
    .limit(1);
  return result[0] ? toEmployee(result[0]) : null;
}

/**
 * Get employee by email
 */
export async function getEmployeeByEmail(email: string): Promise<EmployeeType | null> {
  const result = await db.select().from(employees).where(eq(employees.email, email)).limit(1);
  return result[0] ? toEmployee(result[0]) : null;
}

/**
 * Get safe employee (without password) by employeeId
 */
export async function getSafeEmployeeByEmployeeId(employeeId: string): Promise<SafeEmployee | null> {
  const result = await db.select().from(employees).where(eq(employees.employeeId, employeeId)).limit(1);
  return result[0] ? toSafeEmployee(result[0]) : null;
}

/**
 * Get employee lookup data (for work report form)
 */
export async function getEmployeeLookup(employeeId: string): Promise<EmployeeLookup | null> {
  const result = await db
    .select({
      employeeId: employees.employeeId,
      name: employees.name,
      email: employees.email,
      department: employees.department,
    })
    .from(employees)
    .where(and(eq(employees.employeeId, employeeId), eq(employees.status, 'active')))
    .limit(1);
  return result[0] || null;
}

/**
 * Get all employees
 */
export async function getAllEmployees(): Promise<SafeEmployee[]> {
  const results = await db.select().from(employees).orderBy(desc(employees.createdAt));
  return results.map(toSafeEmployee);
}

/**
 * Get employees by entity
 */
export async function getEmployeesByEntity(entityId: number): Promise<SafeEmployee[]> {
  const results = await db
    .select()
    .from(employees)
    .where(eq(employees.entityId, entityId))
    .orderBy(desc(employees.createdAt));
  return results.map(toSafeEmployee);
}

/**
 * Get employees by branch
 */
export async function getEmployeesByBranch(branchId: number): Promise<SafeEmployee[]> {
  const results = await db
    .select()
    .from(employees)
    .where(eq(employees.branchId, branchId))
    .orderBy(desc(employees.createdAt));
  return results.map(toSafeEmployee);
}

/**
 * Get employees with optional filters (optimized - filters at database level)
 */
export async function getEmployeesWithFilters(filters: {
  entityId?: number | null;
  branchId?: number | null;
  department?: string | null;
  status?: 'active' | 'inactive';
}): Promise<SafeEmployee[]> {
  const conditions = [];
  
  if (filters.status !== undefined) {
    conditions.push(eq(employees.status, filters.status));
  }
  
  if (filters.entityId !== undefined && filters.entityId !== null) {
    conditions.push(eq(employees.entityId, filters.entityId));
  }
  
  if (filters.branchId !== undefined && filters.branchId !== null) {
    conditions.push(eq(employees.branchId, filters.branchId));
  }
  
  if (filters.department !== undefined && filters.department !== null) {
    conditions.push(eq(employees.department, filters.department));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const results = whereClause
    ? await db.select().from(employees).where(whereClause).orderBy(desc(employees.createdAt))
    : await db.select().from(employees).orderBy(desc(employees.createdAt));
  
  return results.map(toSafeEmployee);
}

/**
 * Get team employees for a manager (employees in departments managed by the manager)
 */
export async function getTeamEmployeesForManager(managerId: number): Promise<SafeEmployee[]> {
  // Get department IDs managed by this manager
  const departmentIds = await getManagerDepartmentIds(managerId);
  
  if (departmentIds.length === 0) {
    return [];
  }

  // Get department names from IDs
  const deptResults = await db
    .select({ name: departments.name })
    .from(departments)
    .where(inArray(departments.id, departmentIds));
  
  const departmentNames = deptResults.map((d) => d.name);
  
  if (departmentNames.length === 0) {
    return [];
  }

  // Get employees in those departments
  const results = await db
    .select()
    .from(employees)
    .where(
      and(
        inArray(employees.department, departmentNames),
        eq(employees.status, 'active'),
        // Exclude the manager themselves
        sql`${employees.id} != ${managerId}`
      )
    )
    .orderBy(employees.name);
  
  return results.map(toSafeEmployee);
}

/**
 * Create a new employee
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeType> {
  const result = await db
    .insert(employees)
    .values({
      employeeId: input.employeeId,
      name: input.name,
      email: input.email,
      department: input.department,
      password: input.password,
      entityId: input.entityId ?? null,
      branchId: input.branchId ?? null,
      role: input.role ?? 'employee',
      pageAccess: input.pageAccess ? JSON.stringify(input.pageAccess) : null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to create employee');
  }
  return toEmployee(result[0]!);
}

/**
 * Update an employee
 */
export async function updateEmployee(id: number, input: UpdateEmployeeInput): Promise<EmployeeType | null> {
  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.department !== undefined) updateData.department = input.department;
  if (input.password !== undefined) updateData.password = input.password;
  if (input.entityId !== undefined) updateData.entityId = input.entityId;
  if (input.branchId !== undefined) updateData.branchId = input.branchId;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.pageAccess !== undefined) {
    updateData.pageAccess = input.pageAccess ? JSON.stringify(input.pageAccess) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return getEmployeeById(id);
  }

  updateData.updatedAt = new Date();

  await db.update(employees).set(updateData).where(eq(employees.id, id));
  return getEmployeeById(id);
}

/**
 * Update employee password
 */
export async function updateEmployeePassword(employeeId: string, hashedPassword: string): Promise<boolean> {
  const result = await db
    .update(employees)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(employees.employeeId, employeeId));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete an employee
 */
export async function deleteEmployee(id: number): Promise<boolean> {
  const result = await db.delete(employees).where(eq(employees.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Entity Queries
// ============================================================================

/**
 * Get entity by ID
 */
export async function getEntityById(id: number): Promise<Entity | null> {
  const result = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
  return result[0] ? toEntity(result[0]) : null;
}

/**
 * Get all entities
 */
export async function getAllEntities(): Promise<Entity[]> {
  const results = await db.select().from(entities).orderBy(entities.name);
  return results.map(toEntity);
}

/**
 * Create a new entity
 */
export async function createEntity(input: CreateEntityInput): Promise<Entity> {
  const result = await db.insert(entities).values({ name: input.name }).returning();
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to create entity');
  }
  return toEntity(result[0]!);
}

/**
 * Update an entity
 */
export async function updateEntity(id: number, name: string): Promise<Entity | null> {
  await db.update(entities).set({ name }).where(eq(entities.id, id));
  return getEntityById(id);
}

/**
 * Delete an entity
 */
export async function deleteEntity(id: number): Promise<boolean> {
  const result = await db.delete(entities).where(eq(entities.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Branch Queries
// ============================================================================

/**
 * Get branch by ID
 */
export async function getBranchById(id: number): Promise<Branch | null> {
  const result = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return result[0] ? toBranch(result[0]) : null;
}

/**
 * Get all branches
 */
export async function getAllBranches(): Promise<Branch[]> {
  const results = await db.select().from(branches).orderBy(branches.name);
  return results.map(toBranch);
}

/**
 * Get branches by entity
 */
export async function getBranchesByEntity(entityId: number): Promise<Branch[]> {
  const results = await db.select().from(branches).where(eq(branches.entityId, entityId)).orderBy(branches.name);
  return results.map(toBranch);
}

/**
 * Create a new branch
 */
export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  const result = await db.insert(branches).values({ name: input.name, entityId: input.entityId }).returning();
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to create branch');
  }
  return toBranch(result[0]!);
}

/**
 * Update a branch
 */
export async function updateBranch(id: number, name: string): Promise<Branch | null> {
  await db.update(branches).set({ name }).where(eq(branches.id, id));
  return getBranchById(id);
}

/**
 * Delete a branch
 */
export async function deleteBranch(id: number): Promise<boolean> {
  const result = await db.delete(branches).where(eq(branches.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Work Report Queries
// ============================================================================

/**
 * Get work report by ID
 */
export async function getWorkReportById(id: number): Promise<WorkReport | null> {
  const result = await db.select().from(workReports).where(eq(workReports.id, id)).limit(1);
  return result[0] ? toWorkReport(result[0]) : null;
}

/**
 * Get work reports by employee
 */
export async function getWorkReportsByEmployee(employeeId: string): Promise<WorkReport[]> {
  const results = await db
    .select()
    .from(workReports)
    .where(eq(workReports.employeeId, employeeId))
    .orderBy(desc(workReports.date));
  return results.map(toWorkReport);
}

/**
 * Get work reports by date range
 */
export async function getWorkReportsByDateRange(startDate: string, endDate: string): Promise<WorkReport[]> {
  const results = await db
    .select()
    .from(workReports)
    .where(and(sql`${workReports.date} >= ${startDate}`, sql`${workReports.date} <= ${endDate}`))
    .orderBy(desc(workReports.date));
  return results.map(toWorkReport);
}

/**
 * Get work reports by date range and departments (optimized - filters at database level)
 */
export async function getWorkReportsByDateRangeAndDepartments(
  startDate: string,
  endDate: string,
  departmentNames: string[]
): Promise<WorkReport[]> {
  if (departmentNames.length === 0) {
    return [];
  }
  
  const results = await db
    .select()
    .from(workReports)
    .where(
      and(
        sql`${workReports.date} >= ${startDate}`,
        sql`${workReports.date} <= ${endDate}`,
        inArray(workReports.department, departmentNames)
      )
    )
    .orderBy(desc(workReports.date));
  return results.map(toWorkReport);
}

/**
 * Get work reports by employee and date range (optimized)
 */
export async function getWorkReportsByEmployeeAndDateRange(
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<WorkReport[]> {
  const results = await db
    .select()
    .from(workReports)
    .where(
      and(
        eq(workReports.employeeId, employeeId),
        sql`${workReports.date} >= ${startDate}`,
        sql`${workReports.date} <= ${endDate}`
      )
    )
    .orderBy(desc(workReports.date));
  return results.map(toWorkReport);
}

/**
 * Get work report by employee and date (to check for duplicates)
 */
export async function getWorkReportByEmployeeAndDate(employeeId: string, date: string): Promise<WorkReport | null> {
  const result = await db
    .select()
    .from(workReports)
    .where(and(eq(workReports.employeeId, employeeId), eq(workReports.date, date)))
    .limit(1);
  return result[0] ? toWorkReport(result[0]) : null;
}

/**
 * Get work reports for multiple employees for a specific date
 * Returns a map of employeeId -> WorkReport
 */
export async function getWorkReportsByEmployeeIdsAndDate(
  employeeIds: string[],
  date: string
): Promise<Record<string, WorkReport>> {
  if (employeeIds.length === 0) {
    return {};
  }
  
  const results = await db
    .select()
    .from(workReports)
    .where(
      and(
        inArray(workReports.employeeId, employeeIds),
        eq(workReports.date, date)
      )
    );
  
  const reportMap: Record<string, WorkReport> = {};
  results.forEach(result => {
    const report = toWorkReport(result);
    reportMap[report.employeeId] = report;
  });
  
  return reportMap;
}

/**
 * Create a new work report
 */
export async function createWorkReport(input: CreateWorkReportInput): Promise<WorkReport> {
  const result = await db
    .insert(workReports)
    .values({
      employeeId: input.employeeId,
      date: input.date,
      name: input.name,
      email: input.email,
      department: input.department,
      status: input.status,
      workReport: input.workReport ?? null,
      onDuty: input.onDuty ?? false,
      halfday: input.halfday ?? false,
    })
    .returning();
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to create work report');
  }
  return toWorkReport(result[0]!);
}

/**
 * Get all work reports with pagination
 */
export async function getWorkReports(limit: number = 50, offset: number = 0): Promise<WorkReport[]> {
  const results = await db
    .select()
    .from(workReports)
    .orderBy(desc(workReports.date), desc(workReports.createdAt))
    .limit(limit)
    .offset(offset);
  return results.map(toWorkReport);
}

/**
 * Get work report count
 */
export async function getWorkReportCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(workReports);
  return Number(result[0].count);
}

const SUPER_ADMIN_EXPORT_MAX_ROWS = 100_000;

/**
 * Work reports for super-admin CSV export (joined with employee entity/branch when present).
 */
export async function getWorkReportsForSuperAdminExport(filters: {
  entityId?: number;
  branchId?: number;
  department?: string;
  status?: 'working' | 'leave' | 'absent';
  startDate?: string;
  endDate?: string;
  /** When true, ignore start/end and include all dates (still capped by row limit). */
  allDates?: boolean;
}): Promise<WorkReportExportRow[]> {
  const conditions = [];

  if (!filters.allDates && filters.startDate && filters.endDate) {
    conditions.push(sql`${workReports.date} >= ${filters.startDate}`);
    conditions.push(sql`${workReports.date} <= ${filters.endDate}`);
  }

  if (filters.department) {
    conditions.push(eq(workReports.department, filters.department));
  }

  if (filters.status) {
    conditions.push(eq(workReports.status, filters.status));
  }

  if (filters.entityId !== undefined) {
    conditions.push(eq(employees.entityId, filters.entityId));
  }

  if (filters.branchId !== undefined) {
    conditions.push(eq(employees.branchId, filters.branchId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const base = db
    .select({
      id: workReports.id,
      employeeId: workReports.employeeId,
      date: workReports.date,
      name: workReports.name,
      email: workReports.email,
      department: workReports.department,
      status: workReports.status,
      workReport: workReports.workReport,
      onDuty: workReports.onDuty,
      halfday: workReports.halfday,
      createdAt: workReports.createdAt,
      entityName: entities.name,
      branchName: branches.name,
    })
    .from(workReports)
    .leftJoin(employees, eq(workReports.employeeId, employees.employeeId))
    .leftJoin(entities, eq(employees.entityId, entities.id))
    .leftJoin(branches, eq(employees.branchId, branches.id));

  const results = await (whereClause ? base.where(whereClause) : base)
    .orderBy(desc(workReports.date), desc(workReports.createdAt))
    .limit(SUPER_ADMIN_EXPORT_MAX_ROWS + 1);

  if (results.length > SUPER_ADMIN_EXPORT_MAX_ROWS) {
    throw new Error(`Export exceeds ${SUPER_ADMIN_EXPORT_MAX_ROWS} rows. Narrow filters or date range.`);
  }

  return results.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    date: row.date,
    name: row.name,
    email: row.email,
    department: row.department,
    status: row.status as WorkReport['status'],
    workReport: row.workReport,
    onDuty: row.onDuty,
    halfday: row.halfday,
    createdAt: toISOString(row.createdAt),
    entityName: row.entityName ?? null,
    branchName: row.branchName ?? null,
  }));
}

/**
 * Search work reports by department, name, or employeeId (case-insensitive)
 */
export async function searchWorkReports(searchQuery: string, filterDepartment?: string): Promise<WorkReport[]> {
  const searchPattern = `%${searchQuery}%`;

  if (filterDepartment && filterDepartment !== 'all') {
    const results = await db
      .select()
      .from(workReports)
      .where(
        and(
          eq(workReports.department, filterDepartment),
          or(
            sql`UPPER(${workReports.employeeId}) LIKE UPPER(${searchPattern})`,
            sql`UPPER(${workReports.name}) LIKE UPPER(${searchPattern})`
          )
        )
      )
      .orderBy(desc(workReports.date), desc(workReports.createdAt));
    return results.map(toWorkReport);
  }

  const results = await db
    .select()
    .from(workReports)
    .where(
      or(
        sql`UPPER(${workReports.employeeId}) LIKE UPPER(${searchPattern})`,
        sql`UPPER(${workReports.name}) LIKE UPPER(${searchPattern})`,
        sql`UPPER(${workReports.department}) LIKE UPPER(${searchPattern})`
      )
    )
    .orderBy(desc(workReports.date), desc(workReports.createdAt));
  return results.map(toWorkReport);
}

/**
 * Get work reports by department
 */
export async function getWorkReportsByDepartment(department: string): Promise<WorkReport[]> {
  const results = await db
    .select()
    .from(workReports)
    .where(eq(workReports.department, department))
    .orderBy(desc(workReports.date), desc(workReports.createdAt));
  return results.map(toWorkReport);
}

/**
 * Get unique departments from work reports
 */
export async function getUniqueWorkReportDepartments(): Promise<string[]> {
  const results = await db
    .selectDistinct({ department: workReports.department })
    .from(workReports)
    .orderBy(workReports.department);
  return results.map((r) => r.department);
}

/**
 * Get unique departments from work reports filtered by manager's departments
 */
export async function getUniqueWorkReportDepartmentsForManager(managerId: number): Promise<string[]> {
  const managerDeptIds = await getManagerDepartmentIds(managerId);

  if (managerDeptIds.length === 0) {
    return [];
  }

  // Get department names for the manager's departments
  const deptNames = await db
    .select({ name: departments.name })
    .from(departments)
    .where(inArray(departments.id, managerDeptIds));
  const allowedDepts = deptNames.map((d) => d.name);

  // Get unique departments from work reports that match manager's departments
  const results = await db
    .selectDistinct({ department: workReports.department })
    .from(workReports)
    .where(inArray(workReports.department, allowedDepts))
    .orderBy(workReports.department);
  return results.map((r) => r.department);
}

/**
 * Search work reports filtered by manager's departments (case-insensitive)
 */
export async function searchWorkReportsForManager(
  searchQuery: string,
  managerId: number,
  filterDepartment?: string
): Promise<WorkReport[]> {
  const managerDeptIds = await getManagerDepartmentIds(managerId);

  if (managerDeptIds.length === 0) {
    return [];
  }

  // Get department names for the manager's departments
  const deptNames = await db
    .select({ name: departments.name })
    .from(departments)
    .where(inArray(departments.id, managerDeptIds));
  const allowedDepts = deptNames.map((d) => d.name);

  const searchPattern = `%${searchQuery}%`;

  if (filterDepartment && filterDepartment !== 'all' && allowedDepts.includes(filterDepartment)) {
    const results = await db
      .select()
      .from(workReports)
      .where(
        and(
          eq(workReports.department, filterDepartment),
          or(
            sql`UPPER(${workReports.employeeId}) LIKE UPPER(${searchPattern})`,
            sql`UPPER(${workReports.name}) LIKE UPPER(${searchPattern})`
          )
        )
      )
      .orderBy(desc(workReports.date), desc(workReports.createdAt));
    return results.map(toWorkReport);
  }

  const results = await db
    .select()
    .from(workReports)
    .where(
      and(
        inArray(workReports.department, allowedDepts),
        or(
          sql`UPPER(${workReports.employeeId}) LIKE UPPER(${searchPattern})`,
          sql`UPPER(${workReports.name}) LIKE UPPER(${searchPattern})`,
          sql`UPPER(${workReports.department}) LIKE UPPER(${searchPattern})`
        )
      )
    )
    .orderBy(desc(workReports.date), desc(workReports.createdAt));
  return results.map(toWorkReport);
}

/**
 * Get work reports by department (filtered for manager)
 */
export async function getWorkReportsByDepartmentForManager(
  department: string,
  managerId: number
): Promise<WorkReport[]> {
  const managerDeptIds = await getManagerDepartmentIds(managerId);

  if (managerDeptIds.length === 0) {
    return [];
  }

  // Check if manager has access to this department
  const deptNames = await db
    .select({ name: departments.name })
    .from(departments)
    .where(inArray(departments.id, managerDeptIds));
  const allowedDepts = deptNames.map((d) => d.name);

  if (!allowedDepts.includes(department)) {
    return [];
  }

  const results = await db
    .select()
    .from(workReports)
    .where(eq(workReports.department, department))
    .orderBy(desc(workReports.date), desc(workReports.createdAt));
  return results.map(toWorkReport);
}

/**
 * Update a work report
 */
export async function updateWorkReport(
  id: number,
  status: string,
  workReport: string | null,
  onDuty?: boolean,
  halfday?: boolean
): Promise<WorkReport | null> {
  const updateData: Record<string, unknown> = {
    status,
    workReport,
  };

  if (onDuty !== undefined) {
    updateData.onDuty = onDuty;
  }

  if (halfday !== undefined) {
    updateData.halfday = halfday;
  }

  await db.update(workReports).set(updateData).where(eq(workReports.id, id));
  return getWorkReportById(id);
}

// ============================================================================
// Password Reset Token Queries
// ============================================================================

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(
  employeeId: string,
  token: string,
  expiresAt: Date
): Promise<PasswordResetToken> {
  // Delete any existing tokens for this employee
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.employeeId, employeeId));

  // Create new token
  const result = await db
    .insert(passwordResetTokens)
    .values({
      employeeId,
      token,
      expiresAt,
    })
    .returning();

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to create password reset token');
  }
  const tokenData = result[0]!;
  return {
    id: tokenData.id,
    employeeId: tokenData.employeeId,
    token: tokenData.token,
    expiresAt: toISOString(tokenData.expiresAt),
    createdAt: toISOString(tokenData.createdAt),
  };
}

/**
 * Get password reset token by token string
 */
export async function getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!result[0]) return null;

  return {
    id: result[0].id,
    employeeId: result[0].employeeId,
    token: result[0].token,
    expiresAt: toISOString(result[0].expiresAt),
    createdAt: toISOString(result[0].createdAt),
  };
}

/**
 * Delete password reset token
 */
export async function deletePasswordResetToken(token: string): Promise<boolean> {
  const result = await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete expired password reset tokens
 */
export async function deleteExpiredPasswordResetTokens(): Promise<number> {
  const result = await db.delete(passwordResetTokens).where(sql`${passwordResetTokens.expiresAt} < NOW()`);
  return result.rowCount ?? 0;
}

// ============================================================================
// Department Queries
// ============================================================================

/**
 * Get department by ID
 */
export async function getDepartmentById(id: number): Promise<Department | null> {
  const result = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
  return result[0] ? toDepartment(result[0]) : null;
}

/**
 * Get department by name
 */
export async function getDepartmentByName(name: string): Promise<Department | null> {
  const result = await db.select().from(departments).where(eq(departments.name, name)).limit(1);
  return result[0] ? toDepartment(result[0]) : null;
}

/**
 * Get all departments
 */
export async function getAllDepartments(): Promise<Department[]> {
  const results = await db.select().from(departments).orderBy(departments.name);
  return results.map(toDepartment);
}

/**
 * Get departments by entity
 */
export async function getDepartmentsByEntity(entityId: number): Promise<Department[]> {
  const results = await db
    .select()
    .from(departments)
    .where(eq(departments.entityId, entityId))
    .orderBy(departments.name);
  return results.map(toDepartment);
}

/**
 * Create a new department
 */
export async function createDepartment(input: CreateDepartmentInput): Promise<Department> {
  const result = await db
    .insert(departments)
    .values({
      name: input.name,
      entityId: input.entityId ?? null,
    })
    .returning();
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to create department');
  }
  return toDepartment(result[0]!);
}

/**
 * Update a department
 */
export async function updateDepartment(id: number, name: string): Promise<Department | null> {
  await db.update(departments).set({ name }).where(eq(departments.id, id));
  return getDepartmentById(id);
}

/**
 * Delete a department
 */
export async function deleteDepartment(id: number): Promise<boolean> {
  const result = await db.delete(departments).where(eq(departments.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Manager Department Queries
// ============================================================================

/**
 * Get departments for a manager
 */
export async function getManagerDepartments(managerId: number): Promise<Department[]> {
  const results = await db
    .select({
      id: departments.id,
      name: departments.name,
      entityId: departments.entityId,
      createdAt: departments.createdAt,
    })
    .from(departments)
    .innerJoin(managerDepartments, eq(departments.id, managerDepartments.departmentId))
    .where(eq(managerDepartments.managerId, managerId))
    .orderBy(departments.name);
  return results.map(toDepartment);
}

/**
 * Get department IDs for a manager
 */
export async function getManagerDepartmentIds(managerId: number): Promise<number[]> {
  const results = await db
    .select({ departmentId: managerDepartments.departmentId })
    .from(managerDepartments)
    .where(eq(managerDepartments.managerId, managerId));
  return results.map((r) => r.departmentId);
}

/**
 * Set departments for a manager (replaces existing)
 */
export async function setManagerDepartments(managerId: number, departmentIds: number[]): Promise<void> {
  // Delete existing mappings
  await db.delete(managerDepartments).where(eq(managerDepartments.managerId, managerId));

  // Insert new mappings
  if (departmentIds.length > 0) {
    await db.insert(managerDepartments).values(
      departmentIds.map((departmentId) => ({
        managerId,
        departmentId,
      }))
    );
  }
}

/**
 * Add a department to a manager
 */
export async function addManagerDepartment(managerId: number, departmentId: number): Promise<boolean> {
  try {
    await db.insert(managerDepartments).values({ managerId, departmentId });
    return true;
  } catch {
    return false; // Already exists or other error
  }
}

/**
 * Remove a department from a manager
 */
export async function removeManagerDepartment(managerId: number, departmentId: number): Promise<boolean> {
  const result = await db
    .delete(managerDepartments)
    .where(and(eq(managerDepartments.managerId, managerId), eq(managerDepartments.departmentId, departmentId)));
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Settings Queries
// ============================================================================

/**
 * Get a setting by key
 */
export async function getSetting(key: string): Promise<Setting | null> {
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!result[0]) return null;
  return {
    id: result[0].id,
    key: result[0].key,
    value: result[0].value,
    updatedAt: toISOString(result[0].updatedAt),
  };
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<Setting[]> {
  const results = await db.select().from(settings).orderBy(settings.key);
  return results.map((row) => ({
    id: row.id,
    key: row.key,
    value: row.value,
    updatedAt: toISOString(row.updatedAt),
  }));
}

/**
 * Update a setting value
 */
export async function updateSetting(key: string, value: string): Promise<Setting | null> {
  // Use raw query for upsert with ON CONFLICT
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
  return getSetting(key);
}

/**
 * Get edit permissions settings
 */
export async function getEditPermissions(): Promise<EditPermissions> {
  const results = await db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        'employee_can_edit_own_reports',
        'manager_can_edit_team_reports',
        'admin_can_edit_reports',
        'superadmin_can_edit_reports',
      ])
    );

  const permissions: EditPermissions = {
    employee_can_edit_own_reports: false,
    manager_can_edit_team_reports: true,
    admin_can_edit_reports: true,
    superadmin_can_edit_reports: true,
  };

  for (const row of results) {
    permissions[row.key as keyof EditPermissions] = row.value === 'true';
  }

  return permissions;
}

/**
 * Update edit permissions settings
 */
export async function updateEditPermissions(permissions: Partial<EditPermissions>): Promise<EditPermissions> {
  for (const [key, value] of Object.entries(permissions)) {
    if (value !== undefined) {
      await updateSetting(key, value.toString());
    }
  }

  return getEditPermissions();
}

// ============================================================================
// OTP Token Queries (for password change verification)
// ============================================================================

export interface OTPToken {
  id: number;
  employeeId: string;
  otp: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Create an OTP token for email verification
 */
export async function createOTPToken(employeeId: string, otp: string, expiresAt: Date): Promise<OTPToken> {
  const result = await db
    .insert(otpTokens)
    .values({
      employeeId,
      otp,
      expiresAt,
    })
    .returning();

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to create OTP token');
  }
  const otpData = result[0]!;
  return {
    id: otpData.id,
    employeeId: otpData.employeeId,
    otp: otpData.otp,
    expiresAt: toISOString(otpData.expiresAt),
    createdAt: toISOString(otpData.createdAt),
  };
}

/**
 * Get a valid OTP token
 */
export async function getOTPToken(employeeId: string, otp: string): Promise<OTPToken | null> {
  const result = await db
    .select()
    .from(otpTokens)
    .where(and(eq(otpTokens.employeeId, employeeId), eq(otpTokens.otp, otp)))
    .limit(1);

  if (!result[0]) return null;

  return {
    id: result[0].id,
    employeeId: result[0].employeeId,
    otp: result[0].otp,
    expiresAt: toISOString(result[0].expiresAt),
    createdAt: toISOString(result[0].createdAt),
  };
}

/**
 * Delete all OTP tokens for an employee
 */
export async function deleteOTPTokensForEmployee(employeeId: string): Promise<void> {
  await db.delete(otpTokens).where(eq(otpTokens.employeeId, employeeId));
}

/**
 * Clean up expired OTP tokens
 */
export async function cleanupExpiredOTPTokens(): Promise<number> {
  const result = await db.delete(otpTokens).where(sql`${otpTokens.expiresAt} < NOW()`);
  return result.rowCount ?? 0;
}

// ============================================================================
// Manager Hierarchy Queries
// ============================================================================

interface ManagerInfo {
  id: number;
  employeeId: string;
  name: string;
  email: string;
}

/**
 * Get managers for a specific department
 */
export async function getManagersForDepartment(departmentName: string): Promise<ManagerInfo[]> {
  // First, get the department ID
  const dept = await db.select({ id: departments.id }).from(departments).where(eq(departments.name, departmentName)).limit(1);

  if (!dept[0]) {
    // If department doesn't exist in departments table, check if any manager has this department directly
    const directManagers = await db
      .select({
        id: employees.id,
        employeeId: employees.employeeId,
        name: employees.name,
        email: employees.email,
      })
      .from(employees)
      .where(
        and(eq(employees.role, 'manager'), eq(employees.department, departmentName), eq(employees.status, 'active'))
      );
    return directManagers;
  }

  // Get managers linked to this department via manager_departments
  const managers = await db
    .select({
      id: employees.id,
      employeeId: employees.employeeId,
      name: employees.name,
      email: employees.email,
    })
    .from(employees)
    .innerJoin(managerDepartments, eq(employees.id, managerDepartments.managerId))
    .where(
      and(
        eq(managerDepartments.departmentId, dept[0].id),
        eq(employees.role, 'manager'),
        eq(employees.status, 'active')
      )
    );

  return managers;
}

// ============================================================================
// Transaction Helper (for complex operations requiring transactions)
// ============================================================================

/**
 * Execute a function within a database transaction
 */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// Holiday Queries
// ============================================================================

import type { Holiday } from '@/types';

/**
 * Create a new holiday
 */
export async function createHoliday(date: string, name: string | null, createdBy: number): Promise<Holiday> {
  const result = await db
    .insert(holidays)
    .values({
      date,
      name: name || null,
      createdBy,
    })
    .returning();
  
  return {
    ...result[0],
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
  };
}

/**
 * Get holidays by year, date range, or default (current + next year)
 */
export async function getHolidays(year?: number, startDate?: string, endDate?: string): Promise<Holiday[]> {
  const baseQuery = db.select().from(holidays);
  
  let dateFilter: ReturnType<typeof and> | undefined;
  
  if (year) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    dateFilter = and(gte(holidays.date, yearStart), lte(holidays.date, yearEnd));
  } else if (startDate && endDate) {
    dateFilter = and(gte(holidays.date, startDate), lte(holidays.date, endDate));
  } else {
    // Default: current year and next year
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${nextYear}-12-31`;
    dateFilter = and(gte(holidays.date, yearStart), lte(holidays.date, yearEnd));
  }
  
  const result = dateFilter 
    ? await baseQuery.where(dateFilter).orderBy(holidays.date)
    : await baseQuery.orderBy(holidays.date);
    
  return result.map(h => ({
    ...h,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  }));
}

/**
 * Get holiday by ID
 */
export async function getHolidayById(id: number): Promise<Holiday | null> {
  const result = await db
    .select()
    .from(holidays)
    .where(eq(holidays.id, id))
    .limit(1);
  
  if (!result[0]) return null;
  
  return {
    ...result[0],
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
  };
}

/**
 * Delete a holiday
 */
export async function deleteHoliday(id: number): Promise<boolean> {
  const result = await db
    .delete(holidays)
    .where(eq(holidays.id, id))
    .returning();
  
  return result.length > 0;
}

/**
 * Update a holiday
 */
export async function updateHoliday(id: number, name: string | null): Promise<Holiday> {
  const result = await db
    .update(holidays)
    .set({
      name: name || null,
      updatedAt: sql`NOW()`,
    })
    .where(eq(holidays.id, id))
    .returning();
  
  return {
    ...result[0],
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
  };
}

/**
 * Check if a holiday exists for a given date
 */
export async function checkHolidayExists(date: string): Promise<boolean> {
  const result = await db
    .select()
    .from(holidays)
    .where(eq(holidays.date, date))
    .limit(1);
  
  return result.length > 0;
}