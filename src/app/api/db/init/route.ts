import { NextResponse } from 'next/server';
import { initializeDatabase, seedInitialData, healthCheck } from '@/lib/db/database';
import { logger } from '@/lib/logger';

// Route segment config - ensure this route is always dynamic and not cached
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Timeout wrapper to prevent hanging requests
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

export async function POST() {
  const startTime = Date.now();

  try {
    logger.info('[DB Init] Starting database initialization...');

    // First, check database connectivity
    logger.info('[DB Init] Checking database connectivity...');
    const health = await withTimeout(
      healthCheck(),
      10000, // 10 second timeout for health check
      'Database health check timed out. Please check your DATABASE_URL and ensure the database is accessible.'
    );

    if (!health.healthy) {
      throw new Error(`Database health check failed: ${health.error || 'Unknown error'}`);
    }

    logger.info(`[DB Init] Database is healthy (response time: ${health.responseTimeMs}ms)`);

    // Initialize database schema
    logger.info('[DB Init] Initializing database schema...');
    await withTimeout(
      initializeDatabase(),
      60000, // 60 second timeout for initialization
      'Database initialization timed out. This may indicate a connection issue or the database is under heavy load.'
    );
    logger.info('[DB Init] Database schema initialized successfully');

    // Seed initial data (creates super admin if no data exists)
    logger.info('[DB Init] Seeding initial data...');
    await withTimeout(
      seedInitialData(),
      30000, // 30 second timeout for seeding
      'Database seeding timed out. Please try again.'
    );
    logger.info('[DB Init] Initial data seeded successfully');

    const duration = Date.now() - startTime;
    logger.info(`[DB Init] Database initialization completed successfully in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      duration: `${duration}ms`,
      healthCheck: {
        responseTime: `${health.responseTimeMs}ms`,
        healthy: health.healthy,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize database';

    // Log full error server-side only
    logger.error('[DB Init] Database initialization error:', error);

    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize database',
        duration: `${duration}ms`,
        hint: isTimeout
          ? 'The database connection timed out. Please check: 1) DATABASE_URL is correct, 2) Database server is running, 3) Network connectivity, 4) Firewall settings'
          : 'Please check your database configuration and ensure the database server is accessible.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST request to initialize the database',
  });
}
