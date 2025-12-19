import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useVitalState } from '@/hooks/useVitalState';

interface RefreshButtonProps {
  onRefresh?: () => Promise<void>;
  lastUpdated?: Date;
  /** If true, invalidates ALL caches globally (default: true) */
  global?: boolean;
}

/**
 * Global Refresh Button - Refreshes ALL data across the entire app
 * 
 * How it works:
 * 1. Uses useVitalState's invalidateAll() to clear ALL React Query caches
 * 2. This triggers re-fetch of data on ALL pages/components
 * 3. Memory is shared via React Query's QueryClient (singleton)
 * 
 * Memory Connection:
 * - All queries share the same QueryClient instance
 * - invalidateAll() marks ALL cached data as stale
 * - Components using useQuery/useDedupedQuery auto-refetch when stale
 * - Real-time subscriptions in useVitalState keep data live between refreshes
 */
export function RefreshButton({ onRefresh, lastUpdated, global = true }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { invalidateAll, invalidateDashboard } = useVitalState();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // GLOBAL REFRESH: Invalidate ALL caches across the entire app
      if (global) {
        invalidateAll();
        console.log('[RefreshButton] Global cache invalidation triggered');
      } else {
        // Just dashboard if not global
        invalidateDashboard();
      }
      
      // Also run custom refresh if provided (e.g., Edge Function sync)
      if (onRefresh) {
        await onRefresh();
      }
      
      toast({
        title: "🔄 Global Refresh",
        description: "All data refreshed across every page",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <span className="text-sm text-muted-foreground">
          Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </span>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
        {global ? 'Refresh All' : 'Refresh'}
      </Button>
    </div>
  );
}
