import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { QUERY_KEYS } from '@/config/queryKeys';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';

export function ErrorMonitorPanel() {
    const [realtimeErrors, setRealtimeErrors] = useState<any[]>([]);

    // Set up real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('sync_errors_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sync_errors'
                },
                (payload) => {
                    setRealtimeErrors(prev => [payload.new, ...prev].slice(0, 5));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const { data: errors, refetch } = useDedupedQuery({
        queryKey: QUERY_KEYS.sync.errors.all,
        dedupeIntervalMs: 1000,
        queryFn: async () => {
            const { data } = await supabase
                .from('sync_errors')
                .select('*')
                .is('resolved_at', null)
                .order('created_at', { ascending: false })
                .limit(20);

            return data || [];
        },
        refetchInterval: 30000,
    });

    const unresolvedCount = errors?.length || 0;
    const criticalCount = errors?.filter(e =>
        e.error_type === 'rate_limit' || e.error_type === 'auth'
    ).length || 0;

    return (
        <Card className={unresolvedCount > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20'}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className={`h-4 w-4 ${unresolvedCount > 0 ? 'text-destructive' : 'text-green-600'}`} />
                        System Health Monitor
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant={unresolvedCount === 0 ? "default" : "destructive"} className="h-7">
                            {unresolvedCount} Active Issues
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}>
                            <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {unresolvedCount === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>All systems operational</span>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {[...realtimeErrors, ...(errors || [])].slice(0, 10).map((error) => (
                            <div key={error.id} className="flex items-start gap-2 p-2 bg-card rounded-lg border text-sm">
                                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge variant="outline" className="text-[10px] h-5">{error.source}</Badge>
                                        <Badge variant="secondary" className="text-[10px] h-5">{error.error_type}</Badge>
                                        <span className="text-[10px] text-muted-foreground">
                                            {new Date(error.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-destructive mt-1 truncate">
                                        {error.error_message}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
