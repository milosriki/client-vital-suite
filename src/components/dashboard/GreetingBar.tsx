import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function GreetingBar() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  // Check for sync errors
  const { data: syncErrors } = useQuery({
    queryKey: ['sync-errors-check'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sync_errors')
        .select('id')
        .eq('resolved', false)
        .limit(5);
      
      if (error) return [];
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Get last sync time
  const { data: lastSync } = useQuery({
    queryKey: ['last-sync-time'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sync_logs')
        .select('started_at, status')
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (error || !data?.[0]) return null;
      return data[0];
    },
    refetchInterval: 30000,
  });

  const hasErrors = (syncErrors?.length || 0) > 0;
  const syncStatus = lastSync?.status === 'completed' ? 'operational' : 'syncing';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-up">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {greeting}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {today}
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        {lastSync && (
          <span className="text-xs text-muted-foreground">
            Last sync: {format(new Date(lastSync.started_at), 'h:mm a')}
          </span>
        )}
        
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
          hasErrors 
            ? "bg-warning/10 text-warning border border-warning/20" 
            : "bg-success/10 text-success border border-success/20"
        )}>
          {hasErrors ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              {syncErrors?.length} Issues
            </>
          ) : syncStatus === 'syncing' ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <CheckCircle className="h-3 w-3" />
              All Systems Operational
            </>
          )}
        </div>
      </div>
    </div>
  );
}
