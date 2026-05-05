import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import { logger } from '../logger';
import * as schema from './schema';

// Get database URL from environment
// WARNING: Default connection string is for development only
// In production, always set DATABASE_URL environment variable
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://workreport_user:Kinn%402022@localhost:5432/workreport_db';

// Log database connection info (without password) for debugging
const dbUrlForLogging = DATABASE_URL.replace(/:[^:@]+@/, ':***@');
console.log('[DB] Connecting to database:', dbUrlForLogging);

// Track connection state
let isPoolHealthy = true;
let lastConnectionError: string | null = null;
let connectionAttempts = 0;
const MAX_CONNECTION_RETRIES = 3;

// Create connection pool with optimized settings for 40-50 concurrent users
const pool = new Pool({
  connectionString: DATABASE_URL || 'postgresql://workreport_user:Kinn%402022@localhost:5432/workreport_db',
  // Connection pool settings
  max: 20, // Maximum number of connections in pool
  min: 2, // Reduced minimum to avoid overwhelming the database on startup
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Increased to 10 seconds for slower connections
  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Listen for pool errors
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
  isPoolHealthy = false;
  lastConnectionError = err.message;
});

// Listen for connection events
pool.on('connect', () => {
  isPoolHealthy = true;
  lastConnectionError = null;
  connectionAttempts = 0;
});

// Create Drizzle database instance with schema
export const db = drizzle(pool, { schema });

// Export the pool for direct access if needed
export { pool };

/**
 * Get the current pool health status
 */
export function getPoolHealth(): { healthy: boolean; error: string | null } {
  return {
    healthy: isPoolHealthy,
    error: lastConnectionError,
  };
}

/**
 * Execute a query with automatic retry on connection failure
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  retries: number = MAX_CONNECTION_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a connection error that warrants a retry
      const isConnectionError = 
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('Connection terminated') ||
        lastError.message.includes('connection timeout') ||
        lastError.message.includes('ENOTFOUND');
      
      if (isConnectionError && attempt < retries) {
        console.warn(`[DB] Connection attempt ${attempt} failed, retrying in ${attempt * 1000}ms...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      // Not a connection error or out of retries
      throw lastError;
    }
  }
  
  throw lastError;
}

/**
 * Get a client from the pool with timeout and better error handling
 */
export async function getClient(): Promise<PoolClient> {
  connectionAttempts++;
  try {
    const client = await pool.connect();
    isPoolHealthy = true;
    lastConnectionError = null;
    return client;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    isPoolHealthy = false;
    lastConnectionError = errorMsg;
    console.error('[DB] Failed to get database client:', errorMsg);
    throw error;
  }
}

// ============================================================================
// Database Utility Functions
// ============================================================================

// Health check result interface
export interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  responseTimeMs: number;
  poolStatus?: {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
}

// Database statistics interface
export interface DatabaseStats {
  poolSize: number;
  poolIdleCount: number;
  poolWaitingCount: number;
  databaseName: string;
  lastError: string | null;
  connectionAttempts: number;
}

/**
 * Health check - verifies database connectivity
 * Returns response time and health status
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  try {
    // Simple query to test connection with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check query timeout (5s)')), 5000);
    });
    
    await Promise.race([
      pool.query('SELECT 1'),
      timeoutPromise
    ]);
    
    const responseTimeMs = performance.now() - startTime;
    isPoolHealthy = true;
    lastConnectionError = null;
    
    return {
      healthy: true,
      responseTimeMs: Math.round(responseTimeMs * 100) / 100,
      poolStatus: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      },
    };
  } catch (error) {
    const responseTimeMs = performance.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    isPoolHealthy = false;
    lastConnectionError = errorMsg;
    
    console.error('[DB] Health check failed:', errorMsg);
    
    return {
      healthy: false,
      error: errorMsg,
      responseTimeMs: Math.round(responseTimeMs * 100) / 100,
      poolStatus: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      },
    };
  }
}

/**
 * Get database statistics for monitoring
 */
export function getDatabaseStats(): DatabaseStats {
  return {
    poolSize: pool.totalCount,
    poolIdleCount: pool.idleCount,
    poolWaitingCount: pool.waitingCount,
    databaseName: 'workreport',
    lastError: lastConnectionError,
    connectionAttempts,
  };
}

/**
 * Check if database is connected
 */
export async function isDatabaseConnected(): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection check timeout')), 5000);
    });
    
    await Promise.race([
      pool.query('SELECT 1'),
      timeoutPromise
    ]);
    return true;
  } catch (error) {
    console.error('[DB] Connection check failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.log('[DB] Database connection pool closed');
}

/**
 * Initialize database schema
 * Creates all required tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  logger.log('[DB] Initializing database schema...');
  
  // Create tables in order (respecting foreign key dependencies)
  await pool.query(`
    -- Create entities table
    CREATE TABLE IF NOT EXISTS entities (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create branches table
    CREATE TABLE IF NOT EXISTS branches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(name, entity_id)
    );

    -- Create departments table
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(name, entity_id)
    );

    -- Create employees table
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      department TEXT NOT NULL,
      password TEXT NOT NULL,
      entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
      branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('employee', 'manager', 'teamhead', 'admin', 'superadmin', 'boardmember')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      page_access TEXT,
      created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create manager_departments junction table
    CREATE TABLE IF NOT EXISTS manager_departments (
      id SERIAL PRIMARY KEY,
      manager_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(manager_id, department_id)
    );

    -- Create work_reports table
    CREATE TABLE IF NOT EXISTS work_reports (
      id SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('working', 'leave', 'absent')),
      work_report TEXT,
      on_duty BOOLEAN DEFAULT FALSE NOT NULL,
      halfday BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create password_reset_tokens table
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create otp_tokens table
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create settings table
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create holidays table
    CREATE TABLE IF NOT EXISTS holidays (
      id SERIAL PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      name TEXT,
      created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create indexes
  await pool.query(`
    -- Employee indexes
    CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
    CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
    CREATE INDEX IF NOT EXISTS idx_employees_entity_id ON employees(entity_id);
    CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);
    CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
    CREATE INDEX IF NOT EXISTS idx_employees_role_status ON employees(role, status);
    CREATE INDEX IF NOT EXISTS idx_employees_entity_branch ON employees(entity_id, branch_id);

    -- Branch indexes
    CREATE INDEX IF NOT EXISTS idx_branches_entity_id ON branches(entity_id);

    -- Department indexes
    CREATE INDEX IF NOT EXISTS idx_departments_entity_id ON departments(entity_id);
    CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

    -- Manager departments indexes
    CREATE INDEX IF NOT EXISTS idx_manager_departments_manager_id ON manager_departments(manager_id);
    CREATE INDEX IF NOT EXISTS idx_manager_departments_department_id ON manager_departments(department_id);

    -- Work reports indexes
    CREATE INDEX IF NOT EXISTS idx_work_reports_employee_id ON work_reports(employee_id);
    CREATE INDEX IF NOT EXISTS idx_work_reports_date ON work_reports(date);
    CREATE INDEX IF NOT EXISTS idx_work_reports_status ON work_reports(status);
    CREATE INDEX IF NOT EXISTS idx_work_reports_department ON work_reports(department);
    CREATE INDEX IF NOT EXISTS idx_work_reports_employee_date ON work_reports(employee_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_work_reports_date_status ON work_reports(date DESC, status);
    CREATE INDEX IF NOT EXISTS idx_work_reports_department_date ON work_reports(department, date DESC);
    CREATE INDEX IF NOT EXISTS idx_work_reports_date_department_status ON work_reports(date DESC, department, status);
    CREATE INDEX IF NOT EXISTS idx_work_reports_created_at ON work_reports(created_at DESC);

    -- Password reset tokens indexes
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_employee_id ON password_reset_tokens(employee_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

    -- OTP tokens indexes
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_employee_id ON otp_tokens(employee_id);
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_otp ON otp_tokens(otp);
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires_at ON otp_tokens(expires_at);

    -- Holidays indexes
    CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    CREATE INDEX IF NOT EXISTS idx_holidays_created_by ON holidays(created_by);
  `);

  // Insert default settings
  await pool.query(`
    INSERT INTO settings (key, value) VALUES 
      ('employee_can_edit_own_reports', 'false'),
      ('manager_can_edit_team_reports', 'true'),
      ('admin_can_edit_reports', 'true'),
      ('superadmin_can_edit_reports', 'true')
    ON CONFLICT (key) DO NOTHING
  `);

  logger.log('[DB] Database schema initialized successfully');
}

/**
 * Seed initial data (optional - for development/testing)
 */
export async function seedInitialData(): Promise<void> {
  const bcrypt = await import('bcrypt');
  
  // Check if we already have data
  const entityResult = await pool.query('SELECT COUNT(*) as count FROM entities');
  if (parseInt(entityResult.rows[0].count) > 0) {
    logger.log('[DB] Database already has data, skipping seed');
    return;
  }

  // Create a default entity
  const entityInsert = await pool.query(
    'INSERT INTO entities (name) VALUES ($1) RETURNING id',
    ['Default Entity']
  );
  const entityId = entityInsert.rows[0].id;

  // Create a default branch
  const branchInsert = await pool.query(
    'INSERT INTO branches (name, entity_id) VALUES ($1, $2) RETURNING id',
    ['Default Branch', entityId]
  );
  const branchId = branchInsert.rows[0].id;

  // Create a super admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT INTO employees (employee_id, name, email, department, password, entity_id, branch_id, role, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['ADMIN001', 'Super Admin', 'admin@company.com', 'Administration', hashedPassword, entityId, branchId, 'superadmin', 'active']
  );

  logger.log('[DB] Initial data seeded successfully');
  logger.log('[DB] Super Admin credentials: Employee ID: ADMIN001, Password: admin123');
}

/**
 * Reset database (drop and recreate)
 */
export async function resetDatabase(): Promise<void> {
  logger.log('[DB] Resetting database...');
  
  // Drop all tables in reverse order of dependencies
  await pool.query(`
    DROP TABLE IF EXISTS holidays CASCADE;
    DROP TABLE IF EXISTS otp_tokens CASCADE;
    DROP TABLE IF EXISTS password_reset_tokens CASCADE;
    DROP TABLE IF EXISTS work_reports CASCADE;
    DROP TABLE IF EXISTS manager_departments CASCADE;
    DROP TABLE IF EXISTS employees CASCADE;
    DROP TABLE IF EXISTS departments CASCADE;
    DROP TABLE IF EXISTS branches CASCADE;
    DROP TABLE IF EXISTS entities CASCADE;
    DROP TABLE IF EXISTS settings CASCADE;
  `);
  
  await initializeDatabase();
  await seedInitialData();
  
  logger.log('[DB] Database reset complete');
}

/**
 * Setup graceful shutdown handlers
 * Ensures database is properly closed on process termination
 */
export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.log(`[DB] Received ${signal}, closing database connection pool...`);
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Test database connection on startup
 * Logs detailed information about connection status
 */
export async function testDatabaseConnection(): Promise<boolean> {
  console.log('[DB] Testing database connection...');
  console.log('[DB] Pool status - Total:', pool.totalCount, ', Idle:', pool.idleCount, ', Waiting:', pool.waitingCount);
  
  try {
    const startTime = Date.now();
    await pool.query('SELECT NOW() as current_time');
    const duration = Date.now() - startTime;
    
    console.log(`[DB] ✓ Database connection successful (${duration}ms)`);
    isPoolHealthy = true;
    lastConnectionError = null;
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DB] ✗ Database connection failed:', errorMsg);
    console.error('[DB] Please check:');
    console.error('[DB]   1. DATABASE_URL environment variable is set correctly');
    console.error('[DB]   2. Database server is running and accessible');
    console.error('[DB]   3. Network connectivity to the database server');
    console.error('[DB]   4. Database credentials are correct');
    
    isPoolHealthy = false;
    lastConnectionError = errorMsg;
    return false;
  }
}

/**
 * Get a detailed connection status report
 */
export function getConnectionStatus(): {
  databaseUrl: string;
  poolHealthy: boolean;
  lastError: string | null;
  poolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
} {
  // Mask the password in the URL for security
  const maskedUrl = DATABASE_URL.replace(/:[^:@]+@/, ':***@');
  
  return {
    databaseUrl: maskedUrl,
    poolHealthy: isPoolHealthy,
    lastError: lastConnectionError,
    poolStats: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
  };
}

// Re-export schema for convenience
export * from './schema';
