import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Command, Phone, GitBranch, Settings, Activity, Shield } from "lucide-react";
import HubSpotCommandCenter from "@/components/ptd/HubSpotCommandCenter";
import AutomationTab from "@/components/ptd/AutomationTab";
import SettingsTab from "@/components/ptd/SettingsTab";
import CallTracking from "./CallTracking";
import WorkflowStrategy from "./WorkflowStrategy";
import HubSpotAnalyzer from "./HubSpotAnalyzer";

export default function Operations() {
  const [mode, setMode] = useState<"test" | "live">(() => {
    const saved = localStorage.getItem("ptd-mode");
    return (saved === "test" || saved === "live") ? saved : "live";
  });
  
  useEffect(() => {
    localStorage.setItem("ptd-mode", mode);
  }, [mode]);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            Operations Center
          </h1>
          <p className="text-muted-foreground">
            Manage workflows, integrations, and system health
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

      <Tabs defaultValue="hubspot" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="hubspot">
            <Command className="h-4 w-4 mr-2" />
            HubSpot
          </TabsTrigger>
          <TabsTrigger value="calls">
            <Phone className="h-4 w-4 mr-2" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="automation">
            <GitBranch className="h-4 w-4 mr-2" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="system">
            <Shield className="h-4 w-4 mr-2" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hubspot" className="space-y-4">
          <HubSpotCommandCenter mode={mode} />
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <div className="border rounded-lg p-4 bg-card">
            <CallTracking />
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Tabs defaultValue="strategy">
            <TabsList>
              <TabsTrigger value="strategy">Strategy</TabsTrigger>
              <TabsTrigger value="analyzer">Analyzer</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="strategy" className="mt-4">
              <WorkflowStrategy />
            </TabsContent>
            <TabsContent value="analyzer" className="mt-4">
              <HubSpotAnalyzer />
            </TabsContent>
            <TabsContent value="rules" className="mt-4">
              <AutomationTab mode="live" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
