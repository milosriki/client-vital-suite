import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, RefreshCw, AlertTriangle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/config/queryKeys";

export function SyncStatusBadge() {
    const queryClient = useQueryClient();
    const [isTriggering, setIsTriggering] = useState(false);

    const { data: lastSync, refetch } = useQuery({
        queryKey: QUERY_KEYS.sync.lastStatus,
        queryFn: async () => {
            // Check sync_logs for last successful sync
            const { data: syncLog } = await supabase
                .from("sync_logs")
                .select("started_at, status, platform")
                .eq("status", "success")
                .order("started_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            // Also check sync_errors for any recent unresolved errors
            const { data: recentErrors } = await supabase
                .from("sync_errors")
                .select("id")
                .is("resolved_at", null)
                .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(1);

            return {
                lastSuccessfulSync: syncLog,
                hasUnresolvedErrors: (recentErrors?.length || 0) > 0
            };
        },
        refetchInterval: 30000,
    });

    // Realtime subscription for sync updates
    useEffect(() => {
        const channel = supabase
            .channel('sync-status-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sync_logs'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sync.lastStatus });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const triggerManualSync = async () => {
        setIsTriggering(true);
        try {
            const { error } = await supabase.functions.invoke('sync-hubspot-to-supabase', {
                body: { source: 'manual-trigger' }
            });
            
            if (error) throw error;
            
            toast.success("Sync triggered successfully");
            refetch();
        } catch (err) {
            toast.error("Failed to trigger sync");
            console.error("Manual sync error:", err);
        } finally {
            setIsTriggering(false);
        }
    };

    if (!lastSync?.lastSuccessfulSync) return (
        <Badge variant="outline" className="gap-1 text-slate-400 border-slate-700">
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking...
        </Badge>
    );

    const timeSince = Date.now() - new Date(lastSync.lastSuccessfulSync.started_at).getTime();
    const hoursSince = timeSince / (1000 * 60 * 60);

    let status: "healthy" | "warning" | "stale" = "healthy";
    if (hoursSince > 24) status = "stale";
    else if (hoursSince > 1 || lastSync.hasUnresolvedErrors) status = "warning";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                        <Badge
                            variant="outline"
                            className={`gap-1.5 transition-colors cursor-pointer ${
                                status === 'healthy' ? 'border-green-800 bg-green-950/30 text-green-400' :
                                status === 'warning' ? 'border-yellow-800 bg-yellow-950/30 text-yellow-400' :
                                'border-red-800 bg-red-950/30 text-red-400'
                            }`}
                        >
                            {status === 'healthy' && <Check className="h-3 w-3" />}
                            {status === 'warning' && <RefreshCw className="h-3 w-3" />}
                            {status === 'stale' && <AlertTriangle className="h-3 w-3" />}

                            {status === 'healthy' ? 'Live' : status === 'warning' ? 'Warning' : 'Stale'}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-slate-800"
                            onClick={triggerManualSync}
                            disabled={isTriggering}
                        >
                            {isTriggering ? (
                                <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                            ) : (
                                <Play className="h-3 w-3 text-slate-400" />
                            )}
                        </Button>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Last sync: {new Date(lastSync.lastSuccessfulSync.started_at).toLocaleString()}</p>
                    <p className="text-xs text-slate-400">Platform: {lastSync.lastSuccessfulSync.platform}</p>
                    {lastSync.hasUnresolvedErrors && (
                        <p className="text-yellow-400 text-xs mt-1">Has unresolved errors</p>
                    )}
                    {status === 'stale' && (
                        <p className="text-red-400 text-xs mt-1">Data is over 24h old!</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">Click play to trigger manual sync</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
