import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MissionControlHeader } from "@/components/dashboard/MissionControlHeader";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { WorkflowStatusDiagram } from "@/components/automation/WorkflowStatusDiagram";
import { UsageGauge } from "@/components/system/UsageGauge";
import { AudioPlayer } from "@/components/calls/AudioPlayer";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Zap,
  Phone,
  Settings2,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
  Server,
  Wifi,
  PhoneCall,
  PhoneMissed,
  PhoneOff
} from "lucide-react";

const CALL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: "Completed", color: "bg-success", icon: CheckCircle },
  answered: { label: "Answered", color: "bg-success", icon: PhoneCall },
  missed: { label: "Missed", color: "bg-destructive", icon: PhoneMissed },
  voicemail: { label: "Voicemail", color: "bg-warning", icon: PhoneOff },
  failed: { label: "Failed", color: "bg-destructive", icon: XCircle },
};

export default function Operations() {
  const [activeTab, setActiveTab] = useState("hubspot");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch sync errors
  const { data: syncErrors, isLoading: errorsLoading, refetch: refetchErrors } = useQuery({
    queryKey: ["sync-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch call records with recordings
  const { data: callRecords, isLoading: callsLoading } = useQuery({
    queryKey: ["call-records-operations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Fetch system settings
  const { data: systemSettings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single();
      if (error) return null;
      return data;
    },
  });

  // Mock API usage (would come from actual metrics)
  const apiUsage = {
    hubspot: { used: 8500, limit: 10000 },
    supabase: { used: 45000, limit: 100000 },
    stripe: { used: 450, limit: 1000 },
  };

  // Connection status
  const connections = [
    { name: "Supabase", status: "connected", icon: Database },
    { name: "HubSpot API", status: "connected", icon: Zap },
    { name: "Stripe API", status: "connected", icon: Server },
    { name: "n8n Workflows", status: "warning", icon: Activity },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchErrors();
      setLastUpdated(new Date());
      toast({ title: "Data refreshed", description: "Operations data updated" });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <MissionControlHeader
          title="Operations Center"
          subtitle="System health, integrations, and automation monitoring"
          isConnected={true}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 lg:w-auto lg:inline-grid bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="hubspot" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Zap className="h-4 w-4 hidden sm:block" />
              <span>HubSpot</span>
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Phone className="h-4 w-4 hidden sm:block" />
              <span>Calls</span>
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Activity className="h-4 w-4 hidden sm:block" />
              <span>Automation</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Settings2 className="h-4 w-4 hidden sm:block" />
              <span>System</span>
            </TabsTrigger>
          </TabsList>

          {/* HubSpot Tab */}
          <TabsContent value="hubspot" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Connection Status */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5 text-success" />
                    HubSpot Connection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg border border-success/20">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-3 h-3 bg-success rounded-full" />
                        <div className="absolute inset-0 w-3 h-3 bg-success rounded-full animate-ping opacity-75" />
                      </div>
                      <span className="font-medium">Connected</span>
                    </div>
                    <Badge variant="outline" className="text-success border-success/30">
                      Active
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span>{format(new Date(), "HH:mm:ss")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Portal ID</span>
                      <span className="font-mono">139617706</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Usage */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle>API Usage</CardTitle>
                  <CardDescription>Daily API call limits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center gap-6">
                    <UsageGauge
                      value={apiUsage.hubspot.used}
                      max={apiUsage.hubspot.limit}
                      label="HubSpot"
                      size="sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sync Errors */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Sync Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errorsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : syncErrors && syncErrors.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {syncErrors.slice(0, 5).map((error: any) => (
                        <div
                          key={error.id}
                          className="p-2 bg-destructive/10 rounded border border-destructive/20 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            <span className="truncate">{error.error_message}</span>
                          </div>
                          <span className="text-xs text-muted-foreground ml-6">
                            {format(new Date(error.created_at), "MMM d, HH:mm")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="h-10 w-10 mx-auto text-success opacity-50 mb-2" />
                      <p className="text-sm text-muted-foreground">No sync errors</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Live Activity */}
            <LiveActivityFeed />
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Call Stats */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Call Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Object.entries(CALL_STATUS_CONFIG).slice(0, 4).map(([status, config]) => {
                      const count = callRecords?.filter((c: any) => c.call_status === status).length || 0;
                      const Icon = config.icon;
                      return (
                        <div key={status} className="text-center p-3 bg-muted/30 rounded-lg">
                          <div className={`w-10 h-10 mx-auto rounded-full ${config.color} flex items-center justify-center mb-2`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <p className="text-2xl font-bold">{count}</p>
                          <p className="text-xs text-muted-foreground">{config.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* API Usage Gauges */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle>System Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-around">
                    <UsageGauge
                      value={apiUsage.supabase.used}
                      max={apiUsage.supabase.limit}
                      label="Database"
                      size="sm"
                    />
                    <UsageGauge
                      value={apiUsage.stripe.used}
                      max={apiUsage.stripe.limit}
                      label="Stripe"
                      size="sm"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Calls with Audio Player */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader>
                <CardTitle>Recent Call Recordings</CardTitle>
                <CardDescription>Listen to call recordings with playback controls</CardDescription>
              </CardHeader>
              <CardContent>
                {callsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : callRecords && callRecords.length > 0 ? (
                  <div className="space-y-4">
                    {callRecords.filter((c: any) => c.recording_url).slice(0, 5).map((call: any) => (
                      <div key={call.id} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">{call.caller_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(call.created_at), "MMM d, HH:mm")} • {Math.floor((call.duration_seconds || 0) / 60)}:{String((call.duration_seconds || 0) % 60).padStart(2, "0")}
                            </p>
                          </div>
                          <Badge className={CALL_STATUS_CONFIG[call.call_status]?.color || "bg-muted"}>
                            {call.call_status}
                          </Badge>
                        </div>
                        <AudioPlayer src={call.recording_url} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Phone className="h-10 w-10 mx-auto text-muted-foreground opacity-50 mb-2" />
                    <p className="text-muted-foreground">No recordings available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-6 mt-0">
            <WorkflowStatusDiagram
              workflows={[
                { id: "1", name: "Lead Assignment", status: "active", executionsToday: 45, successRate: 98, lastRun: "2 min ago" },
                { id: "2", name: "Follow-up Reminder", status: "active", executionsToday: 23, successRate: 95, lastRun: "5 min ago" },
                { id: "3", name: "Health Score Calculation", status: "active", executionsToday: 12, successRate: 100, lastRun: "1 hour ago" },
                { id: "4", name: "No-Show Recovery", status: "paused", executionsToday: 0, successRate: 85, lastRun: "Yesterday" },
                { id: "5", name: "Churn Prevention", status: "active", executionsToday: 8, successRate: 92, lastRun: "30 min ago" },
                { id: "6", name: "HubSpot Sync", status: "error", executionsToday: 156, successRate: 78, lastRun: "10 min ago", errorCount: 3 },
              ]}
              onToggle={(id, active) => {
                toast({
                  title: active ? "Workflow Activated" : "Workflow Paused",
                  description: `Workflow ${id} has been ${active ? "activated" : "paused"}`,
                });
              }}
            />
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Connection Status */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle>Connection Status</CardTitle>
                  <CardDescription>External service connections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {connections.map((conn) => {
                    const Icon = conn.icon;
                    return (
                      <div
                        key={conn.name}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{conn.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              conn.status === "connected"
                                ? "bg-success"
                                : conn.status === "warning"
                                ? "bg-warning"
                                : "bg-destructive"
                            }`}
                          />
                          <span className="text-sm capitalize">{conn.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* API Usage Overview */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle>API Usage Overview</CardTitle>
                  <CardDescription>Daily limits and consumption</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-around">
                    <UsageGauge
                      value={apiUsage.hubspot.used}
                      max={apiUsage.hubspot.limit}
                      label="HubSpot"
                      size="md"
                    />
                    <UsageGauge
                      value={apiUsage.supabase.used}
                      max={apiUsage.supabase.limit}
                      label="Supabase"
                      size="md"
                    />
                    <UsageGauge
                      value={apiUsage.stripe.used}
                      max={apiUsage.stripe.limit}
                      label="Stripe"
                      size="md"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Settings */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>Current system settings and toggles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: "Auto Sync Enabled", value: true },
                    { label: "Real-time Updates", value: true },
                    { label: "Error Notifications", value: true },
                    { label: "AI Recommendations", value: true },
                    { label: "Debug Mode", value: false },
                    { label: "Maintenance Mode", value: false },
                  ].map((setting) => (
                    <div
                      key={setting.label}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <span className="text-sm">{setting.label}</span>
                      <Badge variant={setting.value ? "default" : "secondary"}>
                        {setting.value ? "ON" : "OFF"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
