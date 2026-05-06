import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getEmployeeByEmployeeId, updateEmployeePassword } from './db/queries';
import { logger } from './logger';
import type { Employee, SessionUser, LoginCredentials, PageAccess } from '@/types';
import { DEFAULT_PAGE_ACCESS } from '@/types';

// Constants
const SALT_ROUNDS = 10;
const SESSION_COOKIE_NAME = 'session';
const SESSION_EXPIRY_DAYS = 7;

// Get JWT secret from environment
function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    const errorMsg = 'JWT secret is not configured. Set NEXTAUTH_SECRET or JWT_SECRET in environment variables.';
    if (process.env.NODE_ENV === 'production') {
      console.error('[AUTH ERROR]', errorMsg);
      throw new Error(errorMsg);
    } else {
      logger.warn('[AUTH WARNING]', errorMsg, '- Using fallback secret for development');
      // Use a fallback in development only
      return new TextEncoder().encode('fallback-secret-for-development-only');
    }
  }
  return new TextEncoder().encode(secret);
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a session token (JWT)
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const secret = getJwtSecret();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  const token = await new SignJWT({
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
    status: user.status,
    entityId: user.entityId,
    branchId: user.branchId,
    pageAccess: user.pageAccess,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  return token;
}

/**
 * Verify a session token and return the user data
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    
    return {
      id: payload.id as number,
      employeeId: payload.employeeId as string,
      name: payload.name as string,
      email: payload.email as string,
      department: payload.department as string,
      role: payload.role as SessionUser['role'],
      status: payload.status as SessionUser['status'],
      entityId: payload.entityId as number | null,
      branchId: payload.branchId as number | null,
      pageAccess: payload.pageAccess as PageAccess | null,
    };
  } catch (error) {
    // Log error for debugging
    logger.warn('[AUTH] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Authenticate a user with credentials
 */
export async function authenticateUser(credentials: LoginCredentials): Promise<{ success: boolean; user?: Employee; error?: string }> {
  const { employeeId, password } = credentials;

  // Get employee from database
  const employee = await getEmployeeByEmployeeId(employeeId);
  
  if (!employee) {
    return { success: false, error: 'Invalid employee ID or password' };
  }

  // Check if employee is active
  if (employee.status !== 'active') {
    return { success: false, error: 'Your account has been deactivated. Please contact administrator.' };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, employee.password);
  
  if (!isValidPassword) {
    return { success: false, error: 'Invalid employee ID or password' };
  }

  return { success: true, user: employee };
}

/**
 * Set session cookie
 */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  try {
    const token = await createSessionToken(user);
    const cookieStore = await cookies();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    // Determine if we're in production with HTTPS
    // Check multiple indicators for production HTTPS environment
    const isProduction = process.env.NODE_ENV === 'production';
    const hasHttpsUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');
    const isSecure = isProduction || hasHttpsUrl;

    // For production behind reverse proxy (nginx/Cloudflare), use 'none' with secure
    // This allows cookies to work across different subdomains if needed
    const sameSite = isProduction && isSecure ? 'none' : 'lax';

    // Get domain from environment if set (for subdomain scenarios)
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

    const cookieOptions: Parameters<typeof cookieStore.set>[2] = {
      httpOnly: true,
      secure: isSecure,
      sameSite: sameSite as 'lax' | 'strict' | 'none',
      expires: expiresAt,
      path: '/',
    };

    // Only set domain if explicitly configured (avoid issues with localhost)
    if (cookieDomain && cookieDomain !== 'localhost') {
      cookieOptions.domain = cookieDomain;
    }

    cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions);

    // Log in development for debugging
    logger.debug('[AUTH] Session cookie set:', {
      secure: isSecure,
      sameSite,
      domain: cookieDomain || 'default',
      expires: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[AUTH ERROR] Failed to set session cookie:', error);
    // Re-throw to allow caller to handle
    throw error;
  }
}

/**
 * Get current session from cookies
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!token) {
    return null;
  }

  const user = await verifySessionToken(token);
  
  // If token is valid but user is deactivated, clear session
  if (user && user.status !== 'active') {
    await clearSession();
    return null;
  }

  return user;
}

/**
 * Clear session cookie (logout). Mirror the path/domain/secure attributes used
 * by `setSessionCookie` so the browser actually unsets the cookie that was set.
 * Calling `cookieStore.delete(name)` only matches the default attributes, which
 * means cookies issued with a custom `domain` (e.g. behind a reverse proxy)
 * would otherwise stick around after logout.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();

  const isProduction = process.env.NODE_ENV === 'production';
  const hasHttpsUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');
  const isSecure = isProduction || hasHttpsUrl;
  const sameSite = isProduction && isSecure ? 'none' : 'lax';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    expires: new Date(0),
    maxAge: 0,
    path: '/',
    ...(cookieDomain && cookieDomain !== 'localhost' ? { domain: cookieDomain } : {}),
  });
}

/**
 * Check if user has required role
 */
export function hasRole(user: SessionUser | null, requiredRoles: SessionUser['role'][]): boolean {
  if (!user) return false;
  return requiredRoles.includes(user.role);
}

/**
 * Check if user is admin or superadmin
 */
export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, ['admin', 'superadmin']);
}

/**
 * Check if user is superadmin
 */
export function isSuperAdmin(user: SessionUser | null): boolean {
  return hasRole(user, ['superadmin']);
}

/**
 * Change password for a user
 */
export async function changePassword(employeeId: string, newPassword: string): Promise<boolean> {
  const hashedPassword = await hashPassword(newPassword);
  return updateEmployeePassword(employeeId, hashedPassword);
}

/**
 * Convert Employee to SessionUser (removes sensitive data)
 */
export function employeeToSessionUser(employee: Employee): SessionUser {
  // Parse pageAccess from JSON string or use default based on role
  let pageAccess: PageAccess | null = null;
  if (employee.pageAccess) {
    try {
      pageAccess = JSON.parse(employee.pageAccess) as PageAccess;
    } catch {
      pageAccess = DEFAULT_PAGE_ACCESS[employee.role];
    }
  } else {
    pageAccess = DEFAULT_PAGE_ACCESS[employee.role];
  }

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    department: employee.department,
    role: employee.role,
    status: employee.status,
    entityId: employee.entityId,
    branchId: employee.branchId,
    pageAccess,
  };
}
