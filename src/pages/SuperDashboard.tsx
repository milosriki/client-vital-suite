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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============================================================================
// TOOL CONFIGURATION ("The 200 Buttons")
// ============================================================================

const API_TOOLS = [
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
    } catch (err: any) {
      console.error(err);
      addLog("error", err.message || "Execution failed");
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
          <Badge variant="outline" className="px-4 py-2 text-sm bg-card">
            System Status:{" "}
            <span className="text-green-500 font-bold ml-2">ONLINE</span>
          </Badge>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* LEFT: Control Grid */}
          <Card className="xl:col-span-2 flex flex-col h-full border-muted">
            <CardHeader className="border-b pb-4">
              <CardTitle>Control Grid</CardTitle>
              <CardDescription>
                Select a category to view available actions
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col md:flex-row h-full overflow-hidden">
              {/* Sidebar Categories */}
              <ScrollArea className="w-full md:w-64 border-r bg-muted/20">
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

              {/* Button Grid */}
              <ScrollArea className="flex-1 p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

          {/* RIGHT: Terminal Output */}
          <Card className="flex flex-col h-full border-muted bg-black text-green-500 font-mono shadow-2xl">
            <CardHeader className="border-b border-green-500/20 pb-4 bg-green-500/5">
              <CardTitle className="flex items-center gap-2 text-green-500">
                <Terminal className="w-5 h-5" />
                System Terminal
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden relative">
              <ScrollArea className="h-full p-4">
                <div className="flex flex-col gap-4 text-sm">
                  <div className="opacity-50 text-xs">
                    System initialized. Connected to Gemini 1.5 Pro via Unified
                    Client.
                  </div>
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-1 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex items-center gap-2 text-xs opacity-50">
                        <span>[{log.timestamp}]</span>
                        <span className="uppercase tracking-wider">
                          {log.type}
                        </span>
                      </div>
                      <div
                        className={`
                        p-2 rounded border-l-2 pl-3 
                        ${log.type === "input" ? "border-blue-500 text-blue-300 bg-blue-500/10" : ""}
                        ${log.type === "output" ? "border-green-500 text-green-300 bg-green-500/10" : ""}
                        ${log.type === "error" ? "border-red-500 text-red-300 bg-red-500/10" : ""}
                      `}
                      >
                        {log.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-green-500 animate-pulse">
                      <span className="h-2 w-2 bg-green-500 rounded-full" />
                      Processing request...
                    </div>
                  )}
                  {/* Anchor for auto-scroll could go here */}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
