import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { QUERY_KEYS } from '@/config/queryKeys';

export function HubSpotSyncStatus() {
    const { data: lastSync, refetch, isLoading } = useQuery({
        queryKey: QUERY_KEYS.hubspot.sync.last,
        queryFn: async () => {
            const { data } = await supabase
                .from('sync_errors')
                .select('created_at, error_type, source')
                .eq('source', 'hubspot')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            return data;
        },
        refetchInterval: 30000,
    });

    const isHealthy = !lastSync ||
        (Date.now() - new Date(lastSync.created_at).getTime()) > 3600000; // No errors in last hour

    const triggerManualSync = async () => {
        try {
            const { error } = await supabase.functions.invoke('sync-hubspot-to-supabase');
            if (error) throw error;

            toast({
                title: 'Sync Triggered',
                description: 'HubSpot sync has been started',
            });

            setTimeout(() => refetch(), 2000);
        } catch (error: any) {
            toast({
                title: 'Sync Failed',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="flex items-center gap-2">
            {isLoading ? (
                <Badge variant="outline" className="gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Checking...
                </Badge>
            ) : isHealthy ? (
                <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    HubSpot Synced
                </Badge>
            ) : (
                <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Sync Issues
                </Badge>
            )}

            <Button
                variant="ghost"
                size="sm"
                onClick={triggerManualSync}
                className="gap-1 h-7 px-2"
            >
                <RefreshCw className="h-3 w-3" />
                Sync
            </Button>

            {lastSync && (
                <span className="text-xs text-muted-foreground">
                    Last: {new Date(lastSync.created_at).toLocaleTimeString()}
                </span>
            )}
        </div>
    );
}
