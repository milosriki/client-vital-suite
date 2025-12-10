import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export function ErrorMonitor() {
    const queryClient = useQueryClient();

    const { data: errors, refetch, isLoading } = useQuery({
        queryKey: ["sync-errors-monitor"],
        queryFn: async () => {
            const { data } = await supabase
                .from("sync_errors")
                .select("*")
                .in("severity", ["critical", "high"])
                .eq("resolved", false)
                .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false })
                .limit(5);
            return data;
        },
        refetchInterval: 30000,
    });

    // Realtime subscription for new errors
    useEffect(() => {
        const channel = supabase
            .channel('error-monitor-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sync_errors'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["sync-errors-monitor"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const resolveError = async (errorId: string) => {
        await supabase
            .from("sync_errors")
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .eq("id", errorId);
        refetch();
    };

    const resolveAll = async () => {
        if (!errors) return;
        await supabase
            .from("sync_errors")
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .in("id", errors.map(e => e.id));
        refetch();
    };

    if (isLoading || !errors || errors.length === 0) return null;

    const criticalCount = errors.filter(e => e.severity === 'critical').length;
    const highCount = errors.filter(e => e.severity === 'high').length;

    return (
        <Alert variant="destructive" className="mb-6 border-red-900 bg-red-950/50 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
                <span>
                    System Alert: {criticalCount > 0 ? `${criticalCount} Critical` : ''} 
                    {criticalCount > 0 && highCount > 0 ? ' + ' : ''}
                    {highCount > 0 ? `${highCount} High Priority` : ''} Error{errors.length > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => refetch()} 
                        className="h-6 text-xs hover:bg-red-900/50"
                    >
                        <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={resolveAll} 
                        className="h-6 text-xs hover:bg-red-900/50"
                    >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve All
                    </Button>
                </div>
            </AlertTitle>
            <div className="mt-2 space-y-1">
                {errors.slice(0, 3).map((error) => (
                    <AlertDescription 
                        key={error.id} 
                        className="flex items-center justify-between text-xs font-mono opacity-90"
                    >
                        <span>
                            [{error.severity?.toUpperCase()}] {error.platform}: {error.error_message}
                            <span className="text-red-400/70 ml-2">
                                ({new Date(error.created_at).toLocaleTimeString()})
                            </span>
                        </span>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => resolveError(error.id)} 
                            className="h-5 text-xs hover:bg-red-900/50 px-2"
                        >
                            Dismiss
                        </Button>
                    </AlertDescription>
                ))}
                {errors.length > 3 && (
                    <p className="text-xs text-red-400/70 mt-1">
                        +{errors.length - 3} more errors...
                    </p>
                )}
            </div>
        </Alert>
    );
}
