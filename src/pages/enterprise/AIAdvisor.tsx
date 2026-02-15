import { useState } from "react";
import { Brain, Zap, MessageSquare, Sparkles, RefreshCw, Copy, UserX } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { useAIAdvisorQueue } from "@/hooks/enterprise/useAIAdvisorQueue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AdvisorIntervention } from "@/types/enterprise";

export default function AIAdvisor() {
  const { queue, revenueAtRisk, isLoading } = useAIAdvisorQueue();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const selected = (queue.data || []).find((i) => i.id === selectedId);

  const handleGenerateScript = async (intervention: AdvisorIntervention) => {
    setSelectedId(intervention.id);
    setIsGenerating(true);
    setScript("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "ptd-agent-gemini",
        {
          body: {
            message: `As a high-end fitness business advisor, create a 3-step intervention script for client ${intervention.client_name}.
          DATA: Health Score ${intervention.health_score}, Zone: ${intervention.health_zone}, Coach: ${intervention.assigned_coach}.
          STAKE: ${intervention.outstanding_sessions} sessions remaining, AED ${intervention.deal_value_aed} deal value.
          GOAL: Re-engage today. Provide a text script, an email script, and one specific advisor tip.`,
          },
        }
      );
      if (error) throw error;
      setScript(data.output || data.response || "No script generated.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to generate script: " + message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-8 bg-background min-h-screen">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  const interventions = queue.data || [];
  const risk = revenueAtRisk.data;

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen text-foreground overflow-x-hidden">
      <DashboardHeader
        title="AI Advisor"
        description="Gemini 3 Flash proactive intervention queue"
      />

      {/* Strategy Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-violet-500/10 border border-violet-500/20">
          <div className="text-xs text-violet-400 uppercase font-bold tracking-widest">
            Active Interventions
          </div>
          <div className="text-3xl font-bold mt-2 font-mono">
            {interventions.length}
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/20">
          <div className="text-xs text-destructive uppercase font-bold">
            Revenue at Risk
          </div>
          <div className="text-3xl font-bold mt-2 font-mono">
            AED {(risk?.atRisk || 0).toLocaleString()}
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-xs text-emerald-400 uppercase font-bold">
            Projected Recovery
          </div>
          <div className="text-3xl font-bold mt-2 font-mono">
            AED {(risk?.projectedRecovery || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue */}
        <Card className="lg:col-span-4 border-border bg-card h-[600px] flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              At-Risk Queue ({interventions.length})
            </h3>
          </div>
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-3 py-4">
              {interventions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleGenerateScript(item)}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all",
                    selectedId === item.id
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/20 border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold truncate">{item.client_name}</p>
                    <Badge
                      className={
                        item.health_zone === "RED"
                          ? "bg-destructive"
                          : "bg-amber-500 text-black"
                      }
                    >
                      {item.health_zone}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-primary" />{" "}
                      {item.health_score}
                    </span>
                    <span>{item.days_since_last_session}d inactive</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {item.reason}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Script Panel */}
        <Card className="lg:col-span-8 border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {selected
                ? `Script for ${selected.client_name}`
                : "Select a client"}
            </h3>
          </div>
          <CardContent className="flex-1 flex flex-col p-6">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <Brain className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">
                  Generating intervention script...
                </p>
              </div>
            ) : script ? (
              <div className="flex-1 space-y-4">
                <ScrollArea className="h-[400px] rounded-xl bg-muted/30 p-6 border border-border">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {script}
                  </pre>
                </ScrollArea>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(script);
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() =>
                      selected && handleGenerateScript(selected)
                    }
                  >
                    <RefreshCw className="h-4 w-4" /> Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground space-y-4">
                <MessageSquare className="h-16 w-16 opacity-30" />
                <p>Select a client to generate an AI intervention script</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
