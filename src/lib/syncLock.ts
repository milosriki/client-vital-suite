/**
 * Sync Lock Utility
 * 
 * Prevents race conditions when multiple components trigger the same sync operation.
 * Uses a simple locking mechanism with automatic timeout release.
 * 
 * FIXES:
 * - Race conditions when multiple sync buttons clicked
 * - Data inconsistency from concurrent operations
 * - Duplicate API calls
 * - Rate limiting to prevent API abuse
 */

interface LockState {
  isLocked: boolean;
  lockedAt: number;
  lockId: string;
}

interface RateLimitState {
  lastExecuted: number;
  executionCount: number;
  windowStart: number;
}

// Lock timeout - auto-release after 2 minutes to prevent deadlocks
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;

// Rate limit: minimum time between same operations (10 seconds)
const RATE_LIMIT_MIN_INTERVAL_MS = 10 * 1000;

// Rate limit: max operations per window (5 per minute)
const RATE_LIMIT_MAX_OPS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Global lock state (persists across component renders)
const locks: Map<string, LockState> = new Map();

// Rate limit state
const rateLimits: Map<string, RateLimitState> = new Map();

// Subscribers for lock state changes
const subscribers: Map<string, Set<(isLocked: boolean) => void>> = new Map();

/**
 * Generate a unique lock ID
 */
function generateLockId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a lock is expired
 */
function isLockExpired(lock: LockState): boolean {
  return Date.now() - lock.lockedAt > LOCK_TIMEOUT_MS;
}

/**
 * Check if rate limited
 * Returns { limited: boolean, waitTime: number (ms) }
 */
export function checkRateLimit(operation: string): { limited: boolean; waitTime: number; reason?: string } {
  const now = Date.now();
  const state = rateLimits.get(operation);
  
  if (!state) {
    return { limited: false, waitTime: 0 };
  }
  
  // Check minimum interval
  const timeSinceLastExec = now - state.lastExecuted;
  if (timeSinceLastExec < RATE_LIMIT_MIN_INTERVAL_MS) {
    const waitTime = RATE_LIMIT_MIN_INTERVAL_MS - timeSinceLastExec;
    return { 
      limited: true, 
      waitTime, 
      reason: `Please wait ${Math.ceil(waitTime / 1000)}s before trying again` 
    };
  }
  
  // Check max operations per window
  const windowElapsed = now - state.windowStart;
  if (windowElapsed < RATE_LIMIT_WINDOW_MS && state.executionCount >= RATE_LIMIT_MAX_OPS) {
    const waitTime = RATE_LIMIT_WINDOW_MS - windowElapsed;
    return { 
      limited: true, 
      waitTime, 
      reason: `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)}s` 
    };
  }
  
  return { limited: false, waitTime: 0 };
}

/**
 * Update rate limit state after successful execution
 */
function updateRateLimit(operation: string): void {
  const now = Date.now();
  const existing = rateLimits.get(operation);
  
  if (!existing || (now - existing.windowStart) >= RATE_LIMIT_WINDOW_MS) {
    // Start new window
    rateLimits.set(operation, {
      lastExecuted: now,
      executionCount: 1,
      windowStart: now,
    });
  } else {
    // Update existing window
    rateLimits.set(operation, {
      ...existing,
      lastExecuted: now,
      executionCount: existing.executionCount + 1,
    });
  }
}

/**
 * Notify subscribers of lock state change
 */
function notifySubscribers(operation: string, isLocked: boolean): void {
  const subs = subscribers.get(operation);
  if (subs) {
    subs.forEach(callback => callback(isLocked));
  }
}

/**
 * Acquire a lock for an operation
 * @param operation - Unique operation name (e.g., 'hubspot-sync', 'stripe-sync')
 * @returns Lock ID if acquired, null if already locked
 */
export function acquireLock(operation: string): string | null {
  const existing = locks.get(operation);
  
  // Check if already locked and not expired
  if (existing && existing.isLocked && !isLockExpired(existing)) {
    console.log(`[SyncLock] Operation "${operation}" is already locked`);
    return null;
  }
  
  // Acquire the lock
  const lockId = generateLockId();
  locks.set(operation, {
    isLocked: true,
    lockedAt: Date.now(),
    lockId
  });
  
  console.log(`[SyncLock] Acquired lock for "${operation}" (ID: ${lockId})`);
  notifySubscribers(operation, true);
  
  return lockId;
}

/**
 * Release a lock for an operation
 * @param operation - Operation name
 * @param lockId - Lock ID returned from acquireLock (optional, for validation)
 */
export function releaseLock(operation: string, lockId?: string): boolean {
  const existing = locks.get(operation);
  
  if (!existing) {
    return true; // No lock exists
  }
  
  // Validate lock ID if provided
  if (lockId && existing.lockId !== lockId) {
    console.warn(`[SyncLock] Lock ID mismatch for "${operation}"`);
    return false;
  }
  
  locks.delete(operation);
  console.log(`[SyncLock] Released lock for "${operation}"`);
  notifySubscribers(operation, false);
  
  return true;
}

/**
 * Check if an operation is currently locked
 */
export function isLocked(operation: string): boolean {
  const existing = locks.get(operation);
  
  if (!existing) {
    return false;
  }
  
  // Auto-release expired locks
  if (isLockExpired(existing)) {
    locks.delete(operation);
    notifySubscribers(operation, false);
    return false;
  }
  
  return existing.isLocked;
}

/**
 * Subscribe to lock state changes
 * @returns Unsubscribe function
 */
export function subscribeLock(
  operation: string, 
  callback: (isLocked: boolean) => void
): () => void {
  if (!subscribers.has(operation)) {
    subscribers.set(operation, new Set());
  }
  
  subscribers.get(operation)!.add(callback);
  
  // Return unsubscribe function
  return () => {
    const subs = subscribers.get(operation);
    if (subs) {
      subs.delete(callback);
    }
  };
}

/**
 * Execute a function with automatic lock management and rate limiting
 * @param operation - Operation name
 * @param fn - Async function to execute
 * @param options - Options for lock behavior
 * @returns Result of the function, or null if lock couldn't be acquired
 */
export async function withLock<T>(
  operation: string,
  fn: () => Promise<T>,
  options?: { skipRateLimit?: boolean }
): Promise<T | null> {
  // Check rate limit first
  if (!options?.skipRateLimit) {
    const rateCheck = checkRateLimit(operation);
    if (rateCheck.limited) {
      console.log(`[SyncLock] Rate limited "${operation}": ${rateCheck.reason}`);
      return null;
    }
  }
  
  const lockId = acquireLock(operation);
  
  if (!lockId) {
    console.log(`[SyncLock] Skipping "${operation}" - already in progress`);
    return null;
  }
  
  try {
    const result = await fn();
    // Update rate limit on successful execution
    updateRateLimit(operation);
    return result;
  } finally {
    releaseLock(operation, lockId);
  }
}

// Common operation names
export const SYNC_OPERATIONS = {
  HUBSPOT_SYNC: 'hubspot-sync',
  STRIPE_SYNC: 'stripe-sync',
  BI_AGENT: 'bi-agent',
  INTERVENTIONS: 'interventions',
  CHURN_PREDICTOR: 'churn-predictor',
  DAILY_REPORT: 'daily-report',
} as const;

