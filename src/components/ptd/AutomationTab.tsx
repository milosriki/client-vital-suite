import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Play, Eye, Upload, RefreshCw, FileText, Activity, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AutomationTabProps {
  mode: "test" | "live";
}

export default function AutomationTab({ mode }: AutomationTabProps) {
  const { toast } = useToast();
  const [csvUrl, setCsvUrl] = useState("");

  // Fetch sync logs
  const { data: logs, refetch: refetchLogs } = useDedupedQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("id, platform, sync_type, status, records_synced, started_at, error_message")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Daily Report
  const runDailyReport = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('daily-report', {
        body: { mode, action: 'generate' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Daily Report Generated", description: data?.message || "Report created successfully" });
      refetchLogs();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate daily report", variant: "destructive" });
    }
  });

  // Data Quality Check
  const runDataQuality = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('data-quality', {
        body: { mode, action: 'check' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "Data Quality Check Complete", 
        description: `Score: ${data?.qualityScore || 'N/A'}% - ${data?.issues?.length || 0} issues found` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run data quality check", variant: "destructive" });
    }
  });

  // Integration Health
  const checkIntegrationHealth = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-health', {
        body: { mode, action: 'check-all' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const healthy = data?.integrations?.filter((i: any) => i.status === 'healthy').length || 0;
      const total = data?.integrations?.length || 0;
      toast({ title: "Integration Health", description: `${healthy}/${total} integrations healthy` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to check integration health", variant: "destructive" });
    }
  });

  // Pipeline Monitor
  const runPipelineMonitor = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('pipeline-monitor', {
        body: { mode, action: 'monitor' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Pipeline Monitor", description: `${data?.pipelinesChecked || 0} pipelines checked` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run pipeline monitor", variant: "destructive" });
    }
  });

  // Coach Analyzer
  const runCoachAnalyzer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('coach-analyzer', {
        body: { mode, action: 'analyze-all' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Coach Analysis Complete", description: `${data?.coachesAnalyzed || 0} coaches analyzed` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze coaches", variant: "destructive" });
    }
  });

  // CAPI Validator
  const runCAPIValidator = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('capi-validator', {
        body: { mode, action: 'validate' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "CAPI Validation Complete", 
        description: `${data?.valid || 0} valid, ${data?.invalid || 0} invalid events` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to validate CAPI events", variant: "destructive" });
    }
  });

  const isAnyLoading = runDailyReport.isPending || runDataQuality.isPending || 
    checkIntegrationHealth.isPending || runPipelineMonitor.isPending || 
    runCoachAnalyzer.isPending || runCAPIValidator.isPending;

  return (
    <div className="space-y-6">
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runDailyReport.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Daily Report</p>
                <p className="text-xs text-muted-foreground">daily-report</p>
              </div>
            </div>
            {runDailyReport.isPending && <p className="text-xs mt-2 text-muted-foreground">Running...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runDataQuality.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold">Data Quality</p>
                <p className="text-xs text-muted-foreground">data-quality</p>
              </div>
            </div>
            {runDataQuality.isPending && <p className="text-xs mt-2 text-muted-foreground">Running...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => checkIntegrationHealth.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">Integration Health</p>
                <p className="text-xs text-muted-foreground">integration-health</p>
              </div>
            </div>
            {checkIntegrationHealth.isPending && <p className="text-xs mt-2 text-muted-foreground">Running...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runPipelineMonitor.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="font-semibold">Pipeline Monitor</p>
                <p className="text-xs text-muted-foreground">pipeline-monitor</p>
              </div>
            </div>
            {runPipelineMonitor.isPending && <p className="text-xs mt-2 text-muted-foreground">Running...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runCoachAnalyzer.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold">Coach Analyzer</p>
                <p className="text-xs text-muted-foreground">coach-analyzer</p>
              </div>
            </div>
            {runCoachAnalyzer.isPending && <p className="text-xs mt-2 text-muted-foreground">Running...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runCAPIValidator.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <CheckCircle className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="font-semibold">CAPI Validator</p>
                <p className="text-xs text-muted-foreground">capi-validator</p>
              </div>
            </div>
            {runCAPIValidator.isPending && <p className="text-xs mt-2 text-muted-foreground">Running...</p>}
          </CardContent>
        </Card>

      </div>

      {/* Backfill CSV to CAPI */}
      <Card>
        <CardHeader>
          <CardTitle>Backfill CSV to CAPI</CardTitle>
          <CardDescription>Process historical events from CSV file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-url">CSV URL</Label>
            <Input
              id="csv-url"
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
              placeholder="https://example.com/events.csv"
            />
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" disabled>
                    <Eye className="h-4 w-4 mr-2" />
                    Preflight
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" disabled>
                    <Play className="h-4 w-4 mr-2" />
                    Simulate
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    <Upload className="h-4 w-4 mr-2" />
                    Run
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync Logs</CardTitle>
              <CardDescription>Recent automation activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.platform}</TableCell>
                      <TableCell>{log.sync_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            log.status === "completed"
                              ? "bg-green-500/10 text-green-500"
                              : log.status === "running"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-red-500/10 text-red-500"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.records_synced || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.started_at ? new Date(log.started_at).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-red-500 max-w-[200px] truncate">
                        {log.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No sync logs found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}