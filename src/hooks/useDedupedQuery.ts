import { useRef } from "react";
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
 * Wraps `useQuery` to avoid duplicate fetches triggered by React StrictMode
 * double-invocation or rapid re-mounts. Returns cached data when the same
 * query key is requested within the configured interval.
 */
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
      const cached = queryClient.getQueryData<TQueryFnData>(ctx.queryKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    lastCallRef.current = { key: keyString, timestamp: now };
    return options.queryFn!(ctx);
  };

  return useQuery<TQueryFnData, TError, TData, TQueryKey>({
    ...options,
    queryFn: wrappedQueryFn,
  });
}

