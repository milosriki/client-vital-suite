import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  BrainCircuit,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Zap,
  Copy,
  Sparkles,
  UserX,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnnounce } from "@/lib/accessibility";

export default function AIBusinessAdvisor() {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [script, setScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. Fetch At-Risk (Red/Yellow) Clients
  const { data: atRiskClients, isLoading } = useDedupedQuery({
    queryKey: ["at-risk-advisor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("*")
        .or("health_zone.eq.RED,health_zone.eq.YELLOW")
        .order("health_score", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const handleGenerateScript = async (client: any) => {
    setSelectedClient(client);
    setIsGenerating(true);
    setScript("");

    try {
      // Rewired: smart-agent → ptd-agent-gemini
      const { data, error } = await supabase.functions.invoke(
        "ptd-agent-gemini",
        {
          body: {
            message: `As a high-end fitness business advisor, create a 3-step intervention script for our client ${client.firstname}. 
          DATA: Health Score ${client.health_score}, Days since last session: ${client.days_since_last_session}, Last Coach Note: ${client.coach_notes || "None"}.
          STAKE: They have ${client.outstanding_sessions} sessions left.
          GOAL: Re-engage them today. Provide a text script, an email script, and one specific advisor tip.`,
          },
        },
      );

      if (error) throw error;
      setScript(
        data.output ||
          data.response ||
          "No script generated. Please try again.",
      );
    } catch (err: any) {
      toast.error("Failed to generate script: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            AI Business Advisor
          </h1>
          <p className="text-muted-foreground">
            Strategic intervention scripts for at-risk clients
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-2 px-4 py-2 border-primary/30 bg-primary/5"
        >
          <BrainCircuit className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">
            PTD Superintelligence v2
          </span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* At-Risk List */}
        <Card className="lg:col-span-4 border-border/50 bg-card/80 backdrop-blur-sm h-[700px] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              At-Risk Queue ({atRiskClients?.length || 0})
            </CardTitle>
            <CardDescription>
              Select a client to generate an intervention plan
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full px-4">
              <div className="space-y-3 pb-4">
                {isLoading ? (
                  <div className="text-center py-10 opacity-50">
                    Loading queue...
                  </div>
                ) : (
                  atRiskClients?.map((client: any) => (
                    <div
                      key={client.email}
                      onClick={() => handleGenerateScript(client)}
                      className={cn(
                        "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                        selectedClient?.email === client.email
                          ? "bg-primary/10 border-primary shadow-glow-sm"
                          : "bg-muted/20 border-border/50 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold truncate">
                          {client.firstname} {client.lastname}
                        </p>
                        <Badge
                          className={
                            client.health_zone === "RED"
                              ? "bg-destructive"
                              : "bg-warning text-black"
                          }
                        >
                          {client.health_zone}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-primary" />
                          Score: {client.health_score}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Inactive: {client.days_since_last_session}d
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* AI Script Panel */}
        <Card className="lg:col-span-8 border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Intervention Plan
            </CardTitle>
            <CardDescription>
              {selectedClient
                ? `Custom strategy for ${selectedClient.firstname} ${selectedClient.lastname}`
                : "Select a client from the queue to start"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <BrainCircuit className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">
                  Analyzing history and drafting scripts...
                </p>
              </div>
            ) : script ? (
              <div className="flex-1 space-y-6">
                <ScrollArea className="h-[500px] w-full rounded-xl bg-slate-950 p-6 border border-border/50">
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {script}
                  </pre>
                </ScrollArea>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(script);
                      toast.success("Script copied to clipboard");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copy All Scripts
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleGenerateScript(selectedClient)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                <MessageSquare className="h-16 w-16 text-muted-foreground" />
                <div>
                  <p className="font-medium">No script generated</p>
                  <p className="text-sm">
                    Choose a client from the left to generate an AI
                    re-engagement plan.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
