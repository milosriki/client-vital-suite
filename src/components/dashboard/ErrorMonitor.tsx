import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function ErrorMonitor() {
    const { data: errors, refetch } = useQuery({
        queryKey: ["sync-errors"],
        queryFn: async () => {
            const { data } = await supabase
                .from("sync_logs")
                .select("*")
                .eq("status", "error")
                .gt("started_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
                .order("started_at", { ascending: false })
                .limit(1);
            return data;
        },
        refetchInterval: 30000, // Check every 30s
    });

    if (!errors || errors.length === 0) return null;

    const error = errors[0];

    const dismissError = async () => {
        await supabase.from("sync_logs").update({ status: "resolved" }).eq("id", error.id);
        refetch();
    };

    return (
        <Alert variant="destructive" className="mb-6 border-red-900 bg-red-950/50 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
                <span>System Alert: {error.platform} Sync Failed</span>
                <Button variant="ghost" size="sm" onClick={dismissError} className="h-6 text-xs hover:bg-red-900/50">
                    Dismiss
                </Button>
            </AlertTitle>
            <AlertDescription className="mt-2 text-xs font-mono opacity-90">
                {error.message} ({new Date(error.started_at).toLocaleTimeString()})
            </AlertDescription>
        </Alert>
    );
}
