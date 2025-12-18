import { useState, useEffect, useCallback } from 'react';
import { 
  acquireLock, 
  releaseLock, 
  isLocked, 
  subscribeLock, 
  withLock,
  SYNC_OPERATIONS 
} from '@/lib/syncLock';
import { toast } from '@/hooks/use-toast';

/**
 * Hook to use sync lock for preventing race conditions
 * 
 * @param operation - The operation name to lock
 * @returns { isLocked, execute } - Lock state and execute function
 */
export function useSyncLock(operation: string) {
  const [locked, setLocked] = useState(() => isLocked(operation));

  useEffect(() => {
    // Subscribe to lock state changes
    const unsubscribe = subscribeLock(operation, (newLockState) => {
      setLocked(newLockState);
    });

    // Check initial state
    setLocked(isLocked(operation));

    return unsubscribe;
  }, [operation]);

  /**
   * Execute a function with automatic lock management
   * Shows toast if operation is already in progress
   */
  const execute = useCallback(async <T>(
    fn: () => Promise<T>,
    options?: {
      showToastOnLock?: boolean;
      lockMessage?: string;
    }
  ): Promise<T | null> => {
    const { showToastOnLock = true, lockMessage } = options || {};
    
    const result = await withLock(operation, fn);
    
    if (result === null && showToastOnLock) {
      toast({
        title: 'Operation in progress',
        description: lockMessage || `${operation} is already running. Please wait.`,
        variant: 'default',
      });
    }
    
    return result;
  }, [operation]);

  /**
   * Manually acquire a lock (use execute() for automatic management)
   */
  const acquire = useCallback(() => {
    return acquireLock(operation);
  }, [operation]);

  /**
   * Manually release a lock
   */
  const release = useCallback((lockId?: string) => {
    return releaseLock(operation, lockId);
  }, [operation]);

  return {
    isLocked: locked,
    execute,
    acquire,
    release,
  };
}

// Re-export operation names for convenience
export { SYNC_OPERATIONS };

