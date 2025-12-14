import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Database, DollarSign, Send, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface DataEnrichmentTabProps {
  mode: "test" | "live";
}

export default function DataEnrichmentTab({ mode }: DataEnrichmentTabProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch pending events queue
  const { data: queueStats } = useQuery({
    queryKey: ["queue-stats", mode],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("capi_events_enriched" as any)
        .select("send_status, count")
        .eq("mode", mode) as any);
      
      if (error) throw error;
      
      const stats = {
        pending: 0,
        enriched: 0,
        sent: 0,
        failed: 0,
      };

      // TODO: Aggregate counts properly
      return stats;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch batch jobs
  const { data: batchJobs } = useQuery({
    queryKey: ["batch-jobs", mode],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("batch_jobs" as any)
        .select("*")
        .eq("mode", mode)
        .order("created_at", { ascending: false })
        .limit(10) as any);
      
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 10000,
  });

  // Fetch batch config
  const { data: batchConfigs } = useQuery({
    queryKey: ["batch-config"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("batch_config" as any)
        .select("*")
        .order("batch_time", { ascending: true }) as any);
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Sync from HubSpot
  const syncHubSpot = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-hubspot-to-capi', {
        body: { mode }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "HubSpot Sync Complete",
        description: `Synced ${data.events_synced} events from HubSpot`,
      });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync HubSpot data",
        variant: "destructive",
      });
    },
  });

  // Enrich with Stripe
  const enrichStripe = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('enrich-with-stripe', {
        body: {}
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Stripe Enrichment Complete",
        description: `Enriched ${data.events_enriched} events with Stripe data`,
      });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
    },
    onError: (error) => {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Failed to enrich with Stripe",
        variant: "destructive",
      });
    },
  });

  // Process batch
  const processBatch = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('process-capi-batch', {
        body: { mode, limit: 200 }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setIsProcessing(false);
      toast({
        title: "Batch Processing Complete",
        description: `Sent ${data.events_sent} events to Meta CAPI`,
      });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
      queryClient.invalidateQueries({ queryKey: ["batch-jobs"] });
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "Batch Failed",
        description: error instanceof Error ? error.message : "Failed to process batch",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Data Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Data Enrichment Pipeline</CardTitle>
          <CardDescription>
            HubSpot → Stripe Enrichment → Batch Processing → Meta CAPI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Pending</div>
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold">{queueStats?.pending || 0}</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Enriched</div>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{queueStats?.enriched || 0}</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Sent</div>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold">{queueStats?.sent || 0}</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Failed</div>
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold">{queueStats?.failed || 0}</div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={() => syncHubSpot.mutate()}
              disabled={syncHubSpot.isPending}
              className="flex-1"
            >
              {syncHubSpot.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Sync HubSpot
            </Button>
            <Button
              onClick={() => enrichStripe.mutate()}
              disabled={enrichStripe.isPending}
              variant="outline"
              className="flex-1"
            >
              {enrichStripe.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              Enrich Stripe
            </Button>
            <Button
              onClick={() => processBatch.mutate()}
              disabled={processBatch.isPending || isProcessing}
              variant="default"
              className="flex-1"
            >
              {processBatch.isPending || isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Process Batch
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Schedule</CardTitle>
          <CardDescription>
            Automated batch processing schedule (Asia/Dubai timezone)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {batchConfigs?.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div>
                  <div className="font-medium">{config.config_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Runs daily at {config.batch_time} • Batch size: {config.batch_size} events
                  </div>
                  {config.last_run && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Last run: {new Date(config.last_run).toLocaleString()}
                    </div>
                  )}
                </div>
                <Badge variant={config.enabled ? "default" : "secondary"}>
                  {config.enabled ? "Active" : "Disabled"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Batch Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Batch Jobs</CardTitle>
              <CardDescription>Latest batch processing executions</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["batch-jobs"] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchJobs?.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.batch_name}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(job.scheduled_time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          job.status === 'completed' ? 'default' :
                          job.status === 'running' ? 'secondary' :
                          job.status === 'failed' ? 'destructive' :
                          'outline'
                        }
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{job.events_count}</TableCell>
                    <TableCell className="text-green-600">{job.events_sent}</TableCell>
                    <TableCell className="text-red-600">{job.events_failed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mode Indicator */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={mode === "test" ? "secondary" : "default"}>
                {mode.toUpperCase()} MODE
              </Badge>
              <span className="text-sm text-muted-foreground">
                {mode === "test" 
                  ? "Test events use test_event_code for Meta validation"
                  : "Production events sent to live Meta CAPI"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
