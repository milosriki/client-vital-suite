import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
  latencyMs: number;
}

// ============================================
// AUTH CHECK
// ============================================

export function checkAuth(req: VercelRequest): { authorized: boolean; error?: string } {
  const accessKey = process.env.PTD_INTERNAL_ACCESS_KEY;

  // If no key configured, allow all
  if (!accessKey) {
    return { authorized: true };
  }

  const providedKey = req.headers['x-ptd-key'] as string | undefined;

  if (!providedKey) {
    return { authorized: false, error: 'Missing x-ptd-key header' };
  }

  if (providedKey !== accessKey) {
    return { authorized: false, error: 'Invalid access key' };
  }

  return { authorized: true };
}

// ============================================
// SUPABASE CLIENT (with circuit breaker state)
// ============================================

let circuitOpen = false;
let circuitOpenedAt: number | null = null;
const CIRCUIT_RESET_MS = 30000; // 30 seconds

export function getSupabase(): SupabaseClient {
  // Check circuit breaker
  if (circuitOpen && circuitOpenedAt) {
    if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
      circuitOpen = false;
      circuitOpenedAt = null;
      console.log('[CIRCUIT] Half-open, attempting reconnect');
    } else {
      throw new Error('Circuit breaker open - Supabase temporarily unavailable');
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(url, key);
}

export function openCircuit() {
  circuitOpen = true;
  circuitOpenedAt = Date.now();
  console.error('[CIRCUIT] Opened due to failures');
}

// ============================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    retryOn?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    retryOn = (e: any) => e?.status === 429 || e?.status >= 500,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// RESPONSE HELPERS
// ============================================

export function success<T>(res: VercelResponse, data: T, startTime: number) {
  return res.status(200).json({
    ok: true,
    data,
    latencyMs: Date.now() - startTime,
  } satisfies ApiResponse<T>);
}

export function error(
  res: VercelResponse,
  code: string,
  message: string,
  status = 500,
  details?: unknown,
  startTime?: number,
) {
  const latencyStart = typeof startTime === 'number' ? startTime : Date.now();
  return res.status(status).json({
    ok: false,
    error: { error: message, code, details },
    latencyMs: Date.now() - latencyStart,
  } satisfies ApiResponse<never>);
}

// ============================================
// SOURCE PRIORITY FOR DATA CONFLICTS
// ============================================

export const SOURCE_PRIORITY: Record<string, { primary: string; fallback: string | null }> = {
  email: { primary: 'hubspot', fallback: 'stripe' },
  phone: { primary: 'hubspot', fallback: 'internal' },
  subscriptionStatus: { primary: 'stripe', fallback: null },
  dealValue: { primary: 'hubspot', fallback: null },
  healthScore: { primary: 'internal', fallback: null },
  lifecycleStage: { primary: 'hubspot', fallback: null },
  lastSession: { primary: 'internal', fallback: null },
};

export function resolveConflict(field: string, sources: Record<string, unknown>): any {
  const priority = SOURCE_PRIORITY[field];
  if (!priority) return Object.values(sources)[0];

  if (sources[priority.primary] !== undefined) {
    return sources[priority.primary];
  }

  if (priority.fallback && sources[priority.fallback] !== undefined) {
    return sources[priority.fallback];
  }

  return Object.values(sources)[0];
}
