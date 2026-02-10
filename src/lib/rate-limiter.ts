import { logger } from '@/lib/logger';

/**
 * In-memory rate limiter for login and sensitive endpoints.
 * 
 * Tracks failed attempts by both IP address and identifier (e.g., employee ID).
 * Implements progressive lockout after too many failed attempts.
 * 
 * NOTE: In-memory storage resets on server restart. For multi-instance 
 * deployments, consider using Redis or a database-backed solution.
 */

interface RateLimitEntry {
    count: number;
    firstAttempt: number;
    lastAttempt: number;
    lockedUntil: number | null;
}

interface RateLimitConfig {
    maxAttempts: number;
    windowMs: number;
    lockoutMs: number;
}

// Default configs
const LOGIN_IP_CONFIG: RateLimitConfig = {
    maxAttempts: 20,       // 20 attempts per IP
    windowMs: 15 * 60 * 1000,  // 15 minute window
    lockoutMs: 15 * 60 * 1000, // 15 minute lockout
};

const LOGIN_ID_CONFIG: RateLimitConfig = {
    maxAttempts: 5,        // 5 attempts per employee ID
    windowMs: 15 * 60 * 1000,  // 15 minute window
    lockoutMs: 15 * 60 * 1000, // 15 minute lockout
};

const RESET_PASSWORD_CONFIG: RateLimitConfig = {
    maxAttempts: 5,        // 5 reset requests per IP
    windowMs: 15 * 60 * 1000,  // 15 minute window
    lockoutMs: 15 * 60 * 1000, // 15 minute lockout
};

// In-memory stores
const loginIpStore = new Map<string, RateLimitEntry>();
const loginIdStore = new Map<string, RateLimitEntry>();
const resetPasswordStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

/**
 * Remove stale entries to prevent memory leaks
 */
function cleanupStaleEntries(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

    lastCleanup = now;

    for (const store of [loginIpStore, loginIdStore, resetPasswordStore]) {
        for (const [key, entry] of store.entries()) {
            const isExpired = (now - entry.lastAttempt) > 30 * 60 * 1000; // 30 min stale
            const isUnlocked = entry.lockedUntil && now > entry.lockedUntil;

            if (isExpired && (!entry.lockedUntil || isUnlocked)) {
                store.delete(key);
            }
        }
    }
}

/**
 * Check if a key is rate-limited
 */
function checkRateLimit(
    store: Map<string, RateLimitEntry>,
    key: string,
    config: RateLimitConfig
): { limited: boolean; retryAfterSeconds: number; remainingAttempts: number } {
    cleanupStaleEntries();

    const now = Date.now();
    const entry = store.get(key);

    if (!entry) {
        return { limited: false, retryAfterSeconds: 0, remainingAttempts: config.maxAttempts };
    }

    // Check if currently locked out
    if (entry.lockedUntil && now < entry.lockedUntil) {
        const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
        return { limited: true, retryAfterSeconds, remainingAttempts: 0 };
    }

    // If lockout expired, reset
    if (entry.lockedUntil && now >= entry.lockedUntil) {
        store.delete(key);
        return { limited: false, retryAfterSeconds: 0, remainingAttempts: config.maxAttempts };
    }

    // Check if window has expired
    if (now - entry.firstAttempt > config.windowMs) {
        store.delete(key);
        return { limited: false, retryAfterSeconds: 0, remainingAttempts: config.maxAttempts };
    }

    // Check if max attempts exceeded
    if (entry.count >= config.maxAttempts) {
        // Trigger lockout
        entry.lockedUntil = now + config.lockoutMs;
        store.set(key, entry);
        const retryAfterSeconds = Math.ceil(config.lockoutMs / 1000);
        return { limited: true, retryAfterSeconds, remainingAttempts: 0 };
    }

    const remainingAttempts = config.maxAttempts - entry.count;
    return { limited: false, retryAfterSeconds: 0, remainingAttempts };
}

/**
 * Record a failed attempt
 */
function recordFailedAttempt(
    store: Map<string, RateLimitEntry>,
    key: string
): void {
    const now = Date.now();
    const entry = store.get(key);

    if (entry) {
        entry.count++;
        entry.lastAttempt = now;
        store.set(key, entry);
    } else {
        store.set(key, {
            count: 1,
            firstAttempt: now,
            lastAttempt: now,
            lockedUntil: null,
        });
    }
}

/**
 * Clear attempts for a key (e.g., on successful login)
 */
function clearAttempts(
    store: Map<string, RateLimitEntry>,
    key: string
): void {
    store.delete(key);
}

// ============================================================
// Public API
// ============================================================

export interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
    remainingAttempts: number;
    reason?: string;
}

/**
 * Check login rate limits (both IP and employee ID)
 */
export function checkLoginRateLimit(ip: string, employeeId: string): RateLimitResult {
    // Check employee ID first (stricter limit)
    const idResult = checkRateLimit(loginIdStore, employeeId.toUpperCase(), LOGIN_ID_CONFIG);
    if (idResult.limited) {
        logger.warn(`[RATE_LIMIT] Employee ID locked: ${employeeId} (too many failed attempts)`);
        return {
            allowed: false,
            retryAfterSeconds: idResult.retryAfterSeconds,
            remainingAttempts: 0,
            reason: 'Too many failed login attempts for this account. Please try again later.',
        };
    }

    // Check IP address
    const ipResult = checkRateLimit(loginIpStore, ip, LOGIN_IP_CONFIG);
    if (ipResult.limited) {
        logger.warn(`[RATE_LIMIT] IP locked: ${ip} (too many login attempts)`);
        return {
            allowed: false,
            retryAfterSeconds: ipResult.retryAfterSeconds,
            remainingAttempts: 0,
            reason: 'Too many login attempts from this location. Please try again later.',
        };
    }

    return {
        allowed: true,
        retryAfterSeconds: 0,
        remainingAttempts: Math.min(idResult.remainingAttempts, ipResult.remainingAttempts),
    };
}

/**
 * Record a failed login attempt (both IP and employee ID)
 */
export function recordFailedLogin(ip: string, employeeId: string): void {
    recordFailedAttempt(loginIpStore, ip);
    recordFailedAttempt(loginIdStore, employeeId.toUpperCase());
}

/**
 * Clear login attempts for an employee ID on successful login
 * (IP attempts are NOT cleared — prevents IP-based attacks even after success)
 */
export function clearLoginAttempts(employeeId: string): void {
    clearAttempts(loginIdStore, employeeId.toUpperCase());
}

/**
 * Check password reset rate limit (IP only)
 */
export function checkResetPasswordRateLimit(ip: string): RateLimitResult {
    const result = checkRateLimit(resetPasswordStore, ip, RESET_PASSWORD_CONFIG);

    if (result.limited) {
        logger.warn(`[RATE_LIMIT] Password reset locked for IP: ${ip}`);
        return {
            allowed: false,
            retryAfterSeconds: result.retryAfterSeconds,
            remainingAttempts: 0,
            reason: 'Too many password reset requests. Please try again later.',
        };
    }

    return {
        allowed: true,
        retryAfterSeconds: 0,
        remainingAttempts: result.remainingAttempts,
    };
}

/**
 * Record a password reset attempt
 */
export function recordResetPasswordAttempt(ip: string): void {
    recordFailedAttempt(resetPasswordStore, ip);
}

/**
 * Get client IP from request headers (handles proxies)
 */
export function getClientIp(headers: Headers): string {
    return (
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        headers.get('cf-connecting-ip') ||
        'unknown'
    );
}
