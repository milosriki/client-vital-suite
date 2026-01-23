import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Terminal,
  Play,
  Shield,
  Users,
  Phone,
  BarChart3,
  Database,
  CreditCard,
  Target,
  Zap,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import MillionDollarPanel from "@/components/ceos/MillionDollarPanel";

// ============================================================================
// TOOL CONFIGURATION ("The 200 Buttons")
// ============================================================================

const API_TOOLS = [
  {
    category: "💰 PROFIT HUNTER",
    icon: <Target className="w-4 h-4 text-emerald-500" />,
    tools: [
      {
        name: "Lost Opportunities",
        prompt:
          "Find leads created > 3 days ago that are still in 'New' status with 0 calls. Use lead_control.",
        variant: "default",
      },
      {
        name: "Unanswered Follow-up",
        prompt:
          "Find leads with 'No Answer' status and NO follow-up task scheduled. Use call_control and lead_control.",
        variant: "default",
      },
      {
        name: "Setter Audit",
        prompt:
          "Run get_coach_performance. List setters with < 10% conversion this week.",
        variant: "default",
      },
      {
        name: "Missed Assessments",
        prompt:
          "Use sales_flow_control to list appointments from yesterday that are NOT marked as 'Held' or 'Sold'.",
        variant: "destructive",
      },
      {
        name: "Revenue Recovery",
        prompt:
          "Run stripe_control with action 'get_events' to find failed payments or unpaid invoices from the last 7 days.",
        variant: "destructive",
      },
      {
        name: "Conv. Ratio Analysis",
        prompt:
          "Calculate conversion ratio (Calls vs Bookings) for the whole team today.",
      },
      // REVENUE ACCELERATORS
      {
        name: "Closing Room (Hot)",
        prompt:
          "Find deals in 'Proposal Sent' or 'Assessment Held' stage that have been stagnant for > 2 days. These are ready to close.",
        variant: "default",
      },
      {
        name: "Upsell Candidates",
        prompt:
          "Find 'Green Zone' clients who have been active for > 3 months. List them as potential upsell targets.",
        variant: "default",
      },
      {
        name: "Zombie Resurrection",
        prompt:
          "Find leads from 30-60 days ago who had 'Interested' status but never bought. Generate a re-engagement offer.",
        variant: "default",
      },
      {
        name: "High Value Focus",
        prompt:
          "List top 10 leads with highest potential value (based on lead score or tags) who haven't been called in 48 hours.",
        variant: "default",
      },
    ],
  },
  {
    category: "Stripe Intelligence",
    icon: <CreditCard className="w-4 h-4" />,
    tools: [
      {
        name: "Live Pulse",
        prompt:
          "Run stripe_control with action 'live_pulse' to get real-time sales.",
      },
      {
        name: "Fraud Scan",
        prompt:
          "Run stripe_control with action 'fraud_scan' to check for suspicious activity.",
        variant: "destructive",
      },
      {
        name: "Integrity Check",
        prompt:
          "Run stripe_control with action 'integrity_check' to audit manual payments.",
      },
      {
        name: "Verification Audit",
        prompt:
          "Run stripe_control with action 'who_verified' to see who verified accounts.",
      },
      {
        name: "Payout Analysis",
        prompt: "Run stripe_control with action 'analyze' on payouts.",
      },
      {
        name: "Deleted Wallets",
        prompt:
          "Run stripe_control with action 'get_deleted_wallets' to find deleted payment methods.",
      },
      { name: "Triple-Match Audit", prompt: "Run payment_integrity_check." },
    ],
  },
  {
    category: "Client Control",
    icon: <Users className="w-4 h-4" />,
    tools: [
      {
        name: "At-Risk Clients (Red)",
        prompt: "Find clients in the RED health zone.",
      },
      {
        name: "High Health Clients",
        prompt: "Find clients with health score > 90.",
      },
      { name: "Coach Performance", prompt: "Run get_coach_performance." },
      {
        name: "Churn Prediction",
        prompt: "Run intelligence_control with function 'churn-predictor'.",
      },
      {
        name: "Client Health Summary",
        prompt: "Get a summary of overall client health scores.",
      },
    ],
  },
  {
    category: "Call Center (CallGear)",
    icon: <Phone className="w-4 h-4" />,
    tools: [
      { name: "Live Calls", prompt: "Check active calls on CallGear." },
      { name: "Queue Stats", prompt: "Get CallGear queue status." },
      { name: "Agent Status", prompt: "Get CallGear employee status." },
      {
        name: "Missed Calls",
        prompt: "List recent missed calls from CallGear.",
      },
      {
        name: "Sentiment Analysis",
        prompt: "Analyze recent call transcripts for negative sentiment.",
      },
    ],
  },
  {
    category: "Sales Pipeline",
    icon: <BarChart3 className="w-4 h-4" />,
    tools: [
      {
        name: "Pipeline Status",
        prompt: "Get a summary of the sales pipeline deals.",
      },
      {
        name: "Stale Deals",
        prompt: "Find deals that haven't moved in 7 days.",
      },
      {
        name: "High Value Leads",
        prompt: "Find leads with potential value > 10k.",
      },
      {
        name: "Appointment Check",
        prompt: "Check upcoming sales appointments.",
      },
      { name: "Yesterday Bookings", prompt: "Show bookings made yesterday." },
    ],
  },
  {
    category: "System & AI",
    icon: <Database className="w-4 h-4" />,
    tools: [
      { name: "System Health", prompt: "Run system_health_check." },
      {
        name: "Sync Status",
        prompt: "Check the status of HubSpot and Stripe syncs.",
      },
      { name: "Error Logs", prompt: "Show recent system errors." },
      {
        name: "API Connection Test",
        prompt: "Run test_api_connections to verify keys.",
      },
      { name: "Memory Search", prompt: "Search agent memory for 'important'." },
    ],
  },
  {
    category: "Admin Actions",
    icon: <Shield className="w-4 h-4" />,
    tools: [
      {
        name: "HubSpot Sync Now",
        prompt: "Run hubspot_control with action 'sync_now'.",
      },
      { name: "Purge Sync Errors", prompt: "Run purge_sync_errors." },
      {
        name: "Rebuild Embeddings",
        prompt: "Regenerate knowledge base embeddings.",
      },
      {
        name: "Emergency Forensics",
        prompt: "Run emergency_forensics on recent logs.",
      },
    ],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function SuperDashboard() {
  const [logs, setLogs] = useState<
    Array<{
      timestamp: string;
      type: "input" | "output" | "error";
      content: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(API_TOOLS[0].category);

  const addLog = (type: "input" | "output" | "error", content: string) => {
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), type, content },
    ]);
  };

  const handleExecute = async (toolName: string, prompt: string) => {
    setIsLoading(true);
    addLog("input", `Executing ${toolName}: "${prompt}"...`);

    try {
      // We use the Gemini Agent as the universal interface
      const { data, error } = await supabase.functions.invoke(
        "ptd-agent-gemini",
        {
          body: {
            message: prompt,
            thread_id: "super-dashboard-" + Date.now(),
          },
        },
      );

      if (error) throw error;

      addLog("output", data.response || JSON.stringify(data));
      toast.success(`${toolName} executed successfully`);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Execution failed";
      addLog("error", message);
      toast.error(`Failed to execute ${toolName}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Super Dashboard
            </h1>
            <p className="text-muted-foreground">
              Unified Command Center •{" "}
              {API_TOOLS.reduce((acc, cat) => acc + cat.tools.length, 0)}{" "}
              Actions Ready
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                Gemini Active
              </span>
            </div>
            <Badge variant="outline" className="px-4 py-2 text-sm bg-card">
              System Health:{" "}
              <span className="text-green-500 font-bold ml-2">98% Optimal</span>
            </Badge>
          </div>
        </div>

        {/* CEO MILLION DOLLAR PANEL */}
        <MillionDollarPanel />

        <div className="grid grid-cols-1 gap-6 h-[calc(100vh-280px)]">
          {/* Main Control Grid - Now Full Width */}
          <Card className="flex flex-col h-full border-muted bg-card/40 backdrop-blur-sm">
            <CardHeader className="border-b pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Control Grid</CardTitle>
                  <CardDescription>
                    Select a category to view available actions
                  </CardDescription>
                </div>
                {/* System Status / Mini Log */}
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  <Terminal className="w-3 h-3" />
                  {isLoading ? (
                    <span className="text-green-500 animate-pulse">
                      Running...
                    </span>
                  ) : logs.length > 0 ? (
                    logs[logs.length - 1].content
                  ) : (
                    "System Ready"
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col md:flex-row h-full overflow-hidden">
              {/* Sidebar Categories */}
              <ScrollArea className="w-full md:w-64 border-r bg-muted/10">
                <div className="p-4 flex flex-col gap-2">
                  {API_TOOLS.map((cat) => (
                    <Button
                      key={cat.category}
                      variant={
                        activeCategory === cat.category ? "secondary" : "ghost"
                      }
                      className="w-full justify-start gap-2"
                      onClick={() => setActiveCategory(cat.category)}
                    >
                      {cat.icon}
                      {cat.category}
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] h-5 px-1.5"
                      >
                        {cat.tools.length}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              {/* Button Grid - Expanded */}
              <ScrollArea className="flex-1 p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {API_TOOLS.find(
                    (c) => c.category === activeCategory,
                  )?.tools.map((tool) => (
                    <Button
                      key={tool.name}
                      variant={
                        tool.variant === "destructive"
                          ? "destructive"
                          : "outline"
                      }
                      className="h-24 flex flex-col gap-2 items-center justify-center text-center p-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      onClick={() => handleExecute(tool.name, tool.prompt)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Play className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                      <span className="font-semibold text-xs whitespace-pre-wrap">
                        {tool.name}
                      </span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
