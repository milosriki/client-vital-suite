import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface SyncStep {
  name: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  count?: number;
  error?: string;
  durationMs?: number;
}

interface SyncResult {
  timestamp: string;
  durationMs: number;
  steps: SyncStep[];
  trigger: string;
}

export function useMasterSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem("master_sync_last");
    return stored ? new Date(stored) : null;
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runSync = useCallback(async (skip?: string[]) => {
    if (isSyncing) return;
    setIsSyncing(true);

    toast({
      title: "🔄 Syncing all data sources...",
      description: "HubSpot → FB Insights → Stripe → Attribution → Owners",
    });

    try {
      const { data, error } = await supabase.functions.invoke("master-sync", {
        body: skip ? { skip } : {},
      });

      if (error) throw error;

      const result: SyncResult = data?.data || data;
      setLastSync(result);
      setLastSyncTime(new Date());
      localStorage.setItem("master_sync_last", new Date().toISOString());

      // Invalidate all cached queries so UI picks up new data
      await queryClient.invalidateQueries();

      const doneSteps = result.steps.filter((s) => s.status === "done");
      const errorSteps = result.steps.filter((s) => s.status === "error");
      const totalRecords = doneSteps.reduce((sum, s) => sum + (s.count || 0), 0);
      const durationSec = (result.durationMs / 1000).toFixed(1);

      if (errorSteps.length === 0) {
        toast({
          title: "✅ Full sync complete",
          description: `${totalRecords.toLocaleString()} records synced across ${doneSteps.length} sources in ${durationSec}s`,
        });
      } else {
        toast({
          title: "⚠️ Sync completed with errors",
          description: `${doneSteps.length}/${result.steps.length} succeeded, ${errorSteps.length} failed: ${errorSteps.map((s) => s.name).join(", ")}`,
          variant: "destructive",
        });
      }

      return result;
    } catch (err: any) {
      toast({
        title: "❌ Sync failed",
        description: err.message || "Failed to run master sync",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, toast, queryClient]);

  return {
    runSync,
    isSyncing,
    lastSync,
    lastSyncTime,
  };
}
