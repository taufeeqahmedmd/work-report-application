import { pool } from '@/lib/db/database';

export interface TeamCheckpointRow {
  id: number;
  title: string;
  description: string | null;
  department: string;
  createdBy: number | null;
  createdAt: string;
}

export interface EmployeeCheckpointRow {
  id: number;
  checkpointId: number;
  employeeId: string;
  isCompleted: boolean;
  assignedBy: number | null;
  assignedAt: string;
  completedAt: string | null;
}

export async function ensureCheckpointTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_checkpoints (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      department VARCHAR(255) NOT NULL,
      created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_checkpoints (
      id SERIAL PRIMARY KEY,
      checkpoint_id INTEGER NOT NULL REFERENCES team_checkpoints(id) ON DELETE CASCADE,
      employee_id VARCHAR(50) NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      assigned_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      UNIQUE(checkpoint_id, employee_id)
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_team_checkpoints_department ON team_checkpoints(department)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_employee_checkpoints_employee_id ON employee_checkpoints(employee_id)');
}
