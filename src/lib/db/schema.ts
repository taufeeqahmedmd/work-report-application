import { pgTable, serial, text, timestamp, integer, boolean, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Entities Table
// ============================================================================
export const entities = pgTable('entities', {
  id: serial('id').primaryKey(),
  name: text('name').unique().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const entitiesRelations = relations(entities, ({ many }) => ({
  branches: many(branches),
  departments: many(departments),
  employees: many(employees),
}));

// ============================================================================
// Branches Table
// ============================================================================
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  entityId: integer('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('branches_name_entity_unique').on(table.name, table.entityId),
  index('idx_branches_entity_id').on(table.entityId),
]);

export const branchesRelations = relations(branches, ({ one, many }) => ({
  entity: one(entities, {
    fields: [branches.entityId],
    references: [entities.id],
  }),
  employees: many(employees),
}));

// ============================================================================
// Departments Table
// ============================================================================
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  entityId: integer('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('departments_name_entity_unique').on(table.name, table.entityId),
  index('idx_departments_entity_id').on(table.entityId),
  index('idx_departments_name').on(table.name),
]);

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  entity: one(entities, {
    fields: [departments.entityId],
    references: [entities.id],
  }),
  managerDepartments: many(managerDepartments),
}));

// ============================================================================
// Employees Table
// ============================================================================
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').unique().notNull(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  department: text('department').notNull(),
  password: text('password').notNull(),
  entityId: integer('entity_id').references(() => entities.id, { onDelete: 'set null' }),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  role: text('role', { enum: ['employee', 'manager', 'teamhead', 'admin', 'superadmin', 'boardmember'] }).notNull().default('employee'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  pageAccess: text('page_access'), // JSON string of PageAccess
  createdBy: integer('created_by'), // Self-referential FK added in database initialization
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_employees_employee_id').on(table.employeeId),
  index('idx_employees_email').on(table.email),
  index('idx_employees_entity_id').on(table.entityId),
  index('idx_employees_branch_id').on(table.branchId),
  index('idx_employees_role').on(table.role),
  index('idx_employees_status').on(table.status),
  index('idx_employees_role_status').on(table.role, table.status),
  index('idx_employees_entity_branch').on(table.entityId, table.branchId),
]);

export const employeesRelations = relations(employees, ({ one, many }) => ({
  entity: one(entities, {
    fields: [employees.entityId],
    references: [entities.id],
  }),
  branch: one(branches, {
    fields: [employees.branchId],
    references: [branches.id],
  }),
  creator: one(employees, {
    fields: [employees.createdBy],
    references: [employees.id],
    relationName: 'creator',
  }),
  managerDepartments: many(managerDepartments),
}));

// ============================================================================
// Manager Departments Junction Table
// ============================================================================
export const managerDepartments = pgTable('manager_departments', {
  id: serial('id').primaryKey(),
  managerId: integer('manager_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('manager_departments_unique').on(table.managerId, table.departmentId),
  index('idx_manager_departments_manager_id').on(table.managerId),
  index('idx_manager_departments_department_id').on(table.departmentId),
]);

export const managerDepartmentsRelations = relations(managerDepartments, ({ one }) => ({
  manager: one(employees, {
    fields: [managerDepartments.managerId],
    references: [employees.id],
  }),
  department: one(departments, {
    fields: [managerDepartments.departmentId],
    references: [departments.id],
  }),
}));

// ============================================================================
// Work Reports Table
// ============================================================================
export const workReports = pgTable('work_reports', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  date: text('date').notNull(), // DATE stored as text (YYYY-MM-DD format)
  name: text('name').notNull(),
  email: text('email').notNull(),
  department: text('department').notNull(),
  status: text('status', { enum: ['working', 'leave', 'absent'] }).notNull(),
  workReport: text('work_report'),
  onDuty: boolean('on_duty').default(false).notNull(),
  halfday: boolean('halfday').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_work_reports_employee_id').on(table.employeeId),
  index('idx_work_reports_date').on(table.date),
  index('idx_work_reports_status').on(table.status),
  index('idx_work_reports_department').on(table.department),
  index('idx_work_reports_employee_date').on(table.employeeId, table.date),
  index('idx_work_reports_date_status').on(table.date, table.status),
  index('idx_work_reports_department_date').on(table.department, table.date),
  index('idx_work_reports_date_department_status').on(table.date, table.department, table.status),
  index('idx_work_reports_created_at').on(table.createdAt),
]);

// ============================================================================
// Password Reset Tokens Table
// ============================================================================
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_password_reset_tokens_employee_id').on(table.employeeId),
  index('idx_password_reset_tokens_token').on(table.token),
  index('idx_password_reset_tokens_expires_at').on(table.expiresAt),
]);

// ============================================================================
// OTP Tokens Table
// ============================================================================
export const otpTokens = pgTable('otp_tokens', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  otp: text('otp').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_otp_tokens_employee_id').on(table.employeeId),
  index('idx_otp_tokens_otp').on(table.otp),
  index('idx_otp_tokens_expires_at').on(table.expiresAt),
]);

// ============================================================================
// Settings Table
// ============================================================================
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// Holidays Table
// ============================================================================
export const holidays = pgTable('holidays', {
  id: serial('id').primaryKey(),
  date: text('date').unique().notNull(), // YYYY-MM-DD format
  name: text('name'), // Optional holiday name/description
  createdBy: integer('created_by').references(() => employees.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_holidays_date').on(table.date),
  index('idx_holidays_created_by').on(table.createdBy),
]);

export const holidaysRelations = relations(holidays, ({ one }) => ({
  creator: one(employees, {
    fields: [holidays.createdBy],
    references: [employees.id],
  }),
}));

// ============================================================================
// Type Exports for use in queries
// ============================================================================
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export type ManagerDepartment = typeof managerDepartments.$inferSelect;
export type NewManagerDepartment = typeof managerDepartments.$inferInsert;

export type WorkReport = typeof workReports.$inferSelect;
export type NewWorkReport = typeof workReports.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type OtpToken = typeof otpTokens.$inferSelect;
export type NewOtpToken = typeof otpTokens.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type Holiday = typeof holidays.$inferSelect;
export type NewHoliday = typeof holidays.$inferInsert;
