import type { PageAccess, SessionUser } from '@/types';

/**
 * Generic page-access checker.
 * Uses strict true-check so undefined/null is treated as no access.
 */
export function hasPageAccess(
  session: SessionUser | null | undefined,
  accessKey: keyof PageAccess
): boolean {
  return session?.pageAccess?.[accessKey] === true;
}

/**
 * Check if a user can mark holidays.
 * Access is fully permission-driven.
 */
export function canMarkHolidays(session: SessionUser | null | undefined): boolean {
  return hasPageAccess(session, 'mark_holidays');
}

/**
 * Check if a user can mark attendance.
 * Access is fully permission-driven.
 */
export function canMarkAttendance(session: SessionUser | null | undefined): boolean {
  return hasPageAccess(session, 'mark_attendance');
}

