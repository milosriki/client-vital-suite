import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardTab from "@/components/ptd/DashboardTab";
import HealthIntelligenceTab from "@/components/ptd/HealthIntelligenceTab";
import CAPITab from "@/components/ptd/CAPITab";
import AutomationTab from "@/components/ptd/AutomationTab";
import SettingsTab from "@/components/ptd/SettingsTab";
import AdEventsTab from "@/components/ptd/AdEventsTab";
import CoachReviewsTab from "@/components/ptd/CoachReviewsTab";
import DataEnrichmentTab from "@/components/ptd/DataEnrichmentTab";
import StripeDashboardTab from "@/components/ptd/StripeDashboardTab";
import StripeForensicsTab from "@/components/ptd/StripeForensicsTab";
import HubSpotCommandCenter from "@/components/ptd/HubSpotCommandCenter";
import PTDUnlimitedChat from "@/components/ai/PTDUnlimitedChat";

export default function PTDControl() {
  // Persist mode to localStorage, default to "live"
  const [mode, setMode] = useState<"test" | "live">(() => {
    const saved = localStorage.getItem("ptd-mode");
    return (saved === "test" || saved === "live") ? saved : "live";
  });

  // Save mode changes to localStorage
  useEffect(() => {
    localStorage.setItem("ptd-mode", mode);
  }, [mode]);

  // Connection status states - initialized as checking
  const [supabaseStatus, setSupabaseStatus] = useState("checking");
  const [n8nStatus, setN8nStatus] = useState("checking");
  const [capiStatus, setCapiStatus] = useState("checking");

  // Check connection statuses on mount and periodically
  useEffect(() => {
    const checkConnections = async () => {
      // Check Supabase connection
      try {
        const { error } = await supabase.from("client_health_scores").select("id").limit(1);
        setSupabaseStatus(error ? "error" : "connected");
      } catch {
        setSupabaseStatus("error");
      }

      // Check n8n connection via sync_logs (if recent successful syncs exist)
      try {
        const { data, error } = await supabase
          .from("sync_logs")
          .select("status, created_at")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) {
          setN8nStatus("warning");
        } else if (data && data.length > 0) {
          const lastSync = new Date(data[0].created_at);
          const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
          setN8nStatus(hoursSinceSync < 24 ? "connected" : "warning");
        } else {
          setN8nStatus("warning");
        }
      } catch {
        setN8nStatus("warning");
      }

      // Check CAPI connection via recent capi_events
      try {
        const { data, error } = await supabase
          .from("capi_events")
          .select("created_at, status")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) {
          setCapiStatus("warning");
        } else if (data && data.length > 0) {
          const lastEvent = new Date(data[0].created_at);
          const hoursSinceEvent = (Date.now() - lastEvent.getTime()) / (1000 * 60 * 60);
          setCapiStatus(hoursSinceEvent < 24 ? "connected" : "warning");
        } else {
          setCapiStatus("warning");
        }
      } catch {
        setCapiStatus("warning");
      }
    };

    checkConnections();
    // Recheck every 60 seconds
    const interval = setInterval(checkConnections, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "checking":
        return <AlertCircle className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "warning":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "checking":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-red-500/10 text-red-500 border-red-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Mode Switch */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">PTD Control Panel</h1>
              <p className="text-sm text-muted-foreground">
                Performance Tracking Dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="mode-switch" className="text-sm">
                  Mode:
                </Label>
                <div className="flex items-center gap-2 p-1 rounded-lg bg-muted">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      mode === "test"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    Test
                  </span>
                  <Switch
                    id="mode-switch"
                    checked={mode === "live"}
                    onCheckedChange={(checked) =>
                      setMode(checked ? "live" : "test")
                    }
                  />
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      mode === "live"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    Live
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Banner */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <Badge variant="outline" className={getStatusColor(supabaseStatus)}>
              {getStatusIcon(supabaseStatus)}
              <span className="ml-1">Supabase</span>
            </Badge>
            <Badge variant="outline" className={getStatusColor(n8nStatus)}>
              {getStatusIcon(n8nStatus)}
              <span className="ml-1">n8n</span>
            </Badge>
            <Badge variant="outline" className={getStatusColor(capiStatus)}>
              {getStatusIcon(capiStatus)}
              <span className="ml-1">CAPI</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-11 mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="stripe">Stripe</TabsTrigger>
            <TabsTrigger value="forensics">🛡️ Forensics</TabsTrigger>
            <TabsTrigger value="hubspot">🔶 HubSpot</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="capi">CAPI</TabsTrigger>
            <TabsTrigger value="events">Ad Events</TabsTrigger>
            <TabsTrigger value="coaches">Coaches</TabsTrigger>
            <TabsTrigger value="enrichment">Pipeline</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab mode={mode} />
          </TabsContent>

          <TabsContent value="stripe">
            <StripeDashboardTab mode={mode} />
          </TabsContent>

          <TabsContent value="forensics">
            <StripeForensicsTab mode={mode} />
          </TabsContent>

          <TabsContent value="hubspot">
            <HubSpotCommandCenter mode={mode} />
          </TabsContent>

          <TabsContent value="health">
            <HealthIntelligenceTab mode={mode} />
          </TabsContent>

          <TabsContent value="capi">
            <CAPITab mode={mode} />
          </TabsContent>

          <TabsContent value="events">
            <AdEventsTab mode={mode} />
          </TabsContent>

          <TabsContent value="coaches">
            <CoachReviewsTab mode={mode} />
          </TabsContent>

          <TabsContent value="enrichment">
            <DataEnrichmentTab mode={mode} />
          </TabsContent>

          <TabsContent value="automation">
            <AutomationTab mode={mode} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* UNLIMITED POWER Agent Chat */}
      <PTDUnlimitedChat />
    </div>
  );
}
