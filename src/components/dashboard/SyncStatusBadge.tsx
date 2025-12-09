import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Check, RefreshCw, AlertTriangle } from "lucide-react";

export function SyncStatusBadge() {
    const { data: lastSync } = useQuery({
        queryKey: ["last-sync-status"],
        queryFn: async () => {
            const { data } = await supabase
                .from("sync_logs")
                .select("started_at, status")
                .eq("status", "success")
                .order("started_at", { ascending: false })
                .limit(1)
                .single();
            return data;
        },
        refetchInterval: 30000,
    });

    if (!lastSync) return (
        <Badge variant="outline" className="gap-1 text-slate-400 border-slate-700">
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking...
        </Badge>
    );

    const timeSince = Date.now() - new Date(lastSync.started_at).getTime();
    const hoursSince = timeSince / (1000 * 60 * 60);

    let status: "healthy" | "warning" | "stale" = "healthy";
    if (hoursSince > 24) status = "stale";
    else if (hoursSince > 1) status = "warning";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <Badge
                        variant="outline"
                        className={`gap-1.5 transition-colors ${status === 'healthy' ? 'border-green-800 bg-green-950/30 text-green-400' :
                                status === 'warning' ? 'border-yellow-800 bg-yellow-950/30 text-yellow-400' :
                                    'border-red-800 bg-red-950/30 text-red-400'
                            }`}
                    >
                        {status === 'healthy' && <Check className="h-3 w-3" />}
                        {status === 'warning' && <RefreshCw className="h-3 w-3" />}
                        {status === 'stale' && <AlertTriangle className="h-3 w-3" />}

                        {status === 'healthy' ? 'Synced' : status === 'warning' ? 'Syncing...' : 'Stale Data'}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Last successful sync: {new Date(lastSync.started_at).toLocaleString()}</p>
                    {status === 'stale' && <p className="text-red-400 text-xs mt-1">Data is over 24h old!</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
