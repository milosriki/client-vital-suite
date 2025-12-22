import { useRef, useCallback } from "react";
import {
  QueryFunction,
  QueryKey,
  UseQueryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

type DedupedOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey> =
  UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    /**
     * Minimum time window (ms) between identical query executions
     * before another network request is allowed.
     */
    dedupeIntervalMs?: number;
  };

/**
 * Default retry configuration with exponential backoff
 * 
 * FIXES:
 * - Transient failures become permanent
 * - No resilience to temporary issues
 * - Poor user experience on network hiccups
 */
const DEFAULT_RETRY_CONFIG = {
  retry: 3, // Retry up to 3 times
  retryDelay: (attemptIndex: number) => {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attemptIndex), 8000);
  },
};

/**
 * Wraps `useQuery` to avoid duplicate fetches triggered by React StrictMode
 * double-invocation or rapid re-mounts. Returns cached data when the same
 * query key is requested within the configured interval.
 * 
 * Also includes:
 * - Automatic retry with exponential backoff
 * - Improved error handling
 * - Deduplication within configurable time window
 */
// Global in-flight promise tracker (shared across hook instances)
const globalInFlight = new Map<string, Promise<unknown>>();

export function useDedupedQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(options: DedupedOptions<TQueryFnData, TError, TData, TQueryKey>) {
  const queryClient = useQueryClient();
  const lastCallRef = useRef<{ key: string; timestamp: number }>({
    key: "",
    timestamp: 0,
  });
  const dedupeInterval = options.dedupeIntervalMs ?? 800;

  if (!options.queryFn) {
    throw new Error("useDedupedQuery requires a queryFn");
  }

  const wrappedQueryFn: QueryFunction<TQueryFnData, TQueryKey> = async (
    ctx
  ) => {
    const keyString = JSON.stringify(ctx.queryKey);
    const now = Date.now();
    const isDuplicate =
      lastCallRef.current.key === keyString &&
      now - lastCallRef.current.timestamp < dedupeInterval;

    if (isDuplicate) {
      // First check if there's an in-flight request we can wait for
      const inFlight = globalInFlight.get(keyString);
      if (inFlight) {
        return inFlight as Promise<TQueryFnData>;
      }

      // Then check cache
      const cached = queryClient.getQueryData<TQueryFnData>(ctx.queryKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    lastCallRef.current = { key: keyString, timestamp: now };

    // Create the promise and track it globally
    const queryFn = options.queryFn as QueryFunction<TQueryFnData, TQueryKey>;
    const fetchPromise = (async () => {
      try {
        return await queryFn(ctx);
      } catch (error) {
        // Log error for debugging (but don't swallow it)
        console.error(`[Query Error] ${keyString}:`, error);
        throw error;
      } finally {
        // Clean up in-flight tracking after completion
        globalInFlight.delete(keyString);
      }
    })();

    // Store the in-flight promise globally
    globalInFlight.set(keyString, fetchPromise);

    return fetchPromise;
  };

  return useQuery<TQueryFnData, TError, TData, TQueryKey>({
    // Apply default retry configuration
    ...DEFAULT_RETRY_CONFIG,
    // User options override defaults
    ...options,
    queryFn: wrappedQueryFn,
  });
}

