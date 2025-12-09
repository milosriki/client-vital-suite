import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SyncLog {
  id: string;
  platform: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_details: any;
  sync_type: string;
  records_failed: number | null;
  records_processed: number | null;
}

export default function ErrorMonitor() {
  const queryClient = useQueryClient();

  // Fetch errors from last 24 hours
  const { data: errors, isLoading, refetch } = useQuery({
    queryKey: ['sync-errors'],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('status', 'error')
        .gte('started_at', twentyFourHoursAgo)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data as SyncLog[];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Real-time subscription for sync_logs changes
  useEffect(() => {
    const channel = supabase
      .channel('sync-logs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sync_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sync-errors'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutation to mark error as resolved
  const resolveError = useMutation({
    mutationFn: async (errorId: string) => {
      const { error } = await supabase
        .from('sync_logs')
        .update({ status: 'resolved' })
        .eq('id', errorId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Error marked as resolved');
      refetch();
    },
    onError: (error: any) => {
      toast.error('Failed to resolve error: ' + error.message);
    }
  });

  const handleDismiss = (errorId: string) => {
    resolveError.mutate(errorId);
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const getErrorMessage = (errorDetails: any): string => {
    if (!errorDetails) return 'Unknown error occurred';

    if (typeof errorDetails === 'string') return errorDetails;

    if (errorDetails.message) return errorDetails.message;
    if (errorDetails.error) return errorDetails.error;
    if (errorDetails.description) return errorDetails.description;

    return JSON.stringify(errorDetails);
  };

  const hasErrors = errors && errors.length > 0;

  return (
    <Card className="border-destructive/20">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {hasErrors ? (
            <>
              <AlertTriangle className="h-5 w-5 text-destructive" />
              System Error Monitor
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              System Error Monitor
            </>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-center py-8">
            Loading error status...
          </div>
        ) : hasErrors ? (
          <div className="space-y-4">
            {/* Error Summary Alert */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>System Errors Detected</AlertTitle>
              <AlertDescription>
                {errors.length} {errors.length === 1 ? 'error has' : 'errors have'} been detected in the last 24 hours.
                Please review and resolve them below.
              </AlertDescription>
            </Alert>

            {/* Error List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {errors.map((error) => (
                  <Card key={error.id} className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          {/* Platform and Sync Type */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="font-semibold">
                              {error.platform.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {error.sync_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(error.started_at)}
                            </span>
                          </div>

                          {/* Error Message */}
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-destructive">
                              Error Message:
                            </p>
                            <p className="text-sm text-foreground bg-background/50 p-2 rounded border border-destructive/20">
                              {getErrorMessage(error.error_details)}
                            </p>
                          </div>

                          {/* Additional Details */}
                          {(error.records_failed !== null || error.records_processed !== null) && (
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              {error.records_processed !== null && (
                                <span>Processed: {error.records_processed}</span>
                              )}
                              {error.records_failed !== null && (
                                <span className="text-destructive font-medium">
                                  Failed: {error.records_failed}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Dismiss Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismiss(error.id)}
                          disabled={resolveError.isPending}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          // No Errors - Healthy State
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700 dark:text-green-400">
              All Systems Operational
            </AlertTitle>
            <AlertDescription className="text-green-600 dark:text-green-500">
              No errors detected in the last 24 hours. All sync operations are running smoothly.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
