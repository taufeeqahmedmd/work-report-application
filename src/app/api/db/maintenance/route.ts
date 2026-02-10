import { NextRequest, NextResponse } from 'next/server';
import {
  getDatabaseStats,
  healthCheck
} from '@/lib/db/database';
import { clearQueueHistory, getQueueStatus } from '@/lib/queue/work-report-queue';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/types';

export interface MaintenanceResult {
  vacuum: {
    success: boolean;
    message: string;
  };
  queueCleanup: {
    success: boolean;
    clearedItems: number;
  };
  databaseStats: {
    poolSize: number;
    poolIdleCount: number;
    poolWaitingCount: number;
  };
  timestamp: string;
}

/**
 * POST /api/db/maintenance
 * Run database maintenance tasks
 * 
 * Note: PostgreSQL handles most maintenance automatically.
 * This endpoint mainly cleans up queue history.
 * 
 * Query params:
 * - clearQueue: boolean (default: false) - Clear queue history
 */
export async function POST(request: NextRequest) {
  try {
    // Check database health first
    const health = await healthCheck();
    if (!health.healthy) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Database is currently unavailable. Please try again later.',
      }, { status: 503 });
    }

    const url = new URL(request.url);
    const doClearQueue = url.searchParams.get('clearQueue') === 'true';

    logger.info('[Maintenance] Starting database maintenance...');

    const result: MaintenanceResult = {
      vacuum: { success: true, message: 'PostgreSQL handles vacuuming automatically (autovacuum)' },
      queueCleanup: { success: false, clearedItems: 0 },
      databaseStats: { poolSize: 0, poolIdleCount: 0, poolWaitingCount: 0 },
      timestamp: new Date().toISOString(),
    };

    // Clear queue history if requested
    if (doClearQueue) {
      logger.info('[Maintenance] Clearing queue history...');
      const queueStatusBefore = getQueueStatus();
      const itemsBeforeCleanup = queueStatusBefore.completed + queueStatusBefore.failed;
      clearQueueHistory();
      result.queueCleanup = {
        success: true,
        clearedItems: itemsBeforeCleanup
      };
    }

    // Get final stats
    const finalStats = getDatabaseStats();
    result.databaseStats = {
      poolSize: finalStats.poolSize,
      poolIdleCount: finalStats.poolIdleCount,
      poolWaitingCount: finalStats.poolWaitingCount,
    };

    logger.info('[Maintenance] Database maintenance completed:', result);

    return NextResponse.json<ApiResponse<MaintenanceResult>>({
      success: true,
      data: result,
      message: 'Database maintenance completed successfully',
    });

  } catch (error) {
    console.error('[Maintenance] Error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Maintenance operation failed',
    }, { status: 500 });
  }
}

/**
 * GET /api/db/maintenance
 * Get information about maintenance tasks
 */
export async function GET() {
  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      description: 'Database maintenance endpoint',
      method: 'POST',
      note: 'PostgreSQL handles most maintenance tasks automatically (autovacuum, analyze)',
      queryParams: {
        clearQueue: {
          type: 'boolean',
          default: false,
          description: 'Clear completed/failed items from queue history',
        },
      },
      examples: {
        withQueueCleanup: 'POST /api/db/maintenance?clearQueue=true',
      },
    },
  });
}
