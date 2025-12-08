import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import DashboardTab from "@/components/ptd/DashboardTab";
import HealthIntelligenceTab from "@/components/ptd/HealthIntelligenceTab";
import CAPITab from "@/components/ptd/CAPITab";
import AutomationTab from "@/components/ptd/AutomationTab";
import SettingsTab from "@/components/ptd/SettingsTab";
import AdEventsTab from "@/components/ptd/AdEventsTab";
import CoachReviewsTab from "@/components/ptd/CoachReviewsTab";
import DataEnrichmentTab from "@/components/ptd/DataEnrichmentTab";
export default function PTDControl() {
  const [mode, setMode] = useState<"test" | "live">("test");
  
  // Connection status states
  const [supabaseStatus, setSupabaseStatus] = useState("connected");
  const [capiStatus, setCapiStatus] = useState("connected");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
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
          <TabsList className="grid w-full grid-cols-8 mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
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
    </div>
  );
}
