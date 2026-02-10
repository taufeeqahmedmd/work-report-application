import { NextResponse } from 'next/server';
import {
  getDatabaseStats,
  healthCheck,
  isDatabaseConnected,
  getConnectionStatus
} from '@/lib/db/database';
import { getQueueStatus, getRecentQueueFailures } from '@/lib/queue/work-report-queue';
import type { ApiResponse } from '@/types';

export interface DatabaseStatsResponse {
  database: {
    healthy: boolean;
    connected: boolean;
    responseTimeMs: number;
    error?: string;
    connectionUrl?: string;
    stats: {
      poolSize: number;
      poolIdleCount: number;
      poolWaitingCount: number;
      databaseName: string;
      lastError: string | null;
      connectionAttempts: number;
    } | null;
  };
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
    avgProcessingTimeMs: number;
    queueHealthy: boolean;
    recentFailures: Array<{
      id: string;
      error?: string;
      timestamp: number;
      retries: number;
    }>;
  };
  system: {
    timestamp: string;
    uptime: number;
    memoryUsage: {
      heapUsed: string;
      heapTotal: string;
      external: string;
      rss: string;
    };
  };
}

/**
 * GET /api/db/stats
 * Returns database and queue statistics for monitoring
 * Useful for health checks and performance monitoring
 */
export async function GET() {
  try {
    // Database health check
    const health = await healthCheck();
    const connected = await isDatabaseConnected();
    const connectionStatus = getConnectionStatus();

    // Get database stats (always try, even if unhealthy - stats might still be available)
    let dbStats = null;
    try {
      dbStats = getDatabaseStats();
    } catch (error) {
      console.error('[API] Failed to get database stats:', error);
    }

    // Queue status
    const queueStatus = getQueueStatus();
    const recentFailures = getRecentQueueFailures(5).map(item => ({
      id: item.id,
      error: item.error,
      timestamp: item.timestamp,
      retries: item.retries,
    }));

    // System stats
    const memoryUsage = process.memoryUsage();

    const response: DatabaseStatsResponse = {
      database: {
        healthy: health.healthy,
        connected,
        responseTimeMs: health.responseTimeMs,
        error: health.error ? 'Database health check failed' : (connectionStatus.lastError ? 'Connection issue detected' : undefined),
        stats: dbStats,
      },
      queue: {
        ...queueStatus,
        recentFailures,
      },
      system: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        },
      },
    };

    // Determine overall health status
    const overallHealthy = health.healthy && queueStatus.queueHealthy;

    return NextResponse.json<ApiResponse<DatabaseStatsResponse>>({
      success: true,
      data: response,
      message: overallHealthy ? 'System healthy' : 'System degraded - check details',
    }, {
      status: overallHealthy ? 200 : 503
    });

  } catch (error) {
    console.error('[API] Database stats error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to get database stats',
    }, { status: 500 });
  }
}
