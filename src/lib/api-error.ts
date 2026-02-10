import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/types';

/**
 * Sanitize an error for API responses.
 * - Logs the full error details server-side for debugging
 * - Returns ONLY a generic, safe message to the client
 * - Never exposes table names, column names, query structure, or stack traces
 */
export function createSafeErrorResponse(
  error: unknown,
  genericMessage: string,
  logContext: string,
  statusCode: number = 500
): NextResponse<ApiResponse> {
  // Log full error details server-side (never sent to client)
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logger.error(`[${logContext}] ${errorMessage}`);
  if (errorStack) {
    console.error(`[${logContext}] Stack:`, errorStack);
  }

  // Detect connection-level errors and provide a friendlier message
  const isConnectionError = 
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('Connection terminated') ||
    errorMessage.includes('connection timeout') ||
    errorMessage.includes('ENOTFOUND');

  const safeMessage = isConnectionError
    ? 'Service temporarily unavailable. Please try again in a few moments.'
    : genericMessage;

  return NextResponse.json<ApiResponse>(
    { success: false, error: safeMessage },
    { status: isConnectionError ? 503 : statusCode }
  );
}

/**
 * Sanitize a per-item error message (e.g., for bulk operations).
 * Returns a generic message instead of raw DB error details.
 */
export function sanitizeItemError(error: unknown, genericMessage: string): string {
  // Log the real error server-side
  const realMessage = error instanceof Error ? error.message : String(error);
  console.error('[ITEM_ERROR]', realMessage);

  // Check for known constraint violations and return safe messages
  if (realMessage.toLowerCase().includes('unique') || realMessage.toLowerCase().includes('duplicate')) {
    return 'A record with this value already exists';
  }
  if (realMessage.toLowerCase().includes('foreign key') || realMessage.toLowerCase().includes('violates')) {
    return 'Invalid reference to a related record';
  }

  return genericMessage;
}
