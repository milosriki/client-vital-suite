import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

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

    const { data: errors, refetch } = useQuery({
        queryKey: ['sync-errors'],
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
        <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        System Health Monitor
                    </CardTitle>
                    <div className="flex gap-2">
                        <Badge variant={unresolvedCount === 0 ? "default" : "destructive"}>
                            {unresolvedCount} Active Issues
                        </Badge>
                        {criticalCount > 0 && (
                            <Badge variant="destructive">{criticalCount} Critical</Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {unresolvedCount === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>All systems operational</span>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {[...realtimeErrors, ...(errors || [])].slice(0, 10).map((error) => (
                            <div key={error.id} className="flex items-start gap-2 p-2 bg-white rounded border">
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline">{error.source}</Badge>
                                        <Badge variant="secondary">{error.error_type}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(error.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-red-700 mt-1 truncate">
                                        {error.error_message}
                                    </p>
                                    {error.retry_count > 0 && (
                                        <span className="text-xs text-orange-600">
                                            Retry {error.retry_count}/{error.max_retries}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
