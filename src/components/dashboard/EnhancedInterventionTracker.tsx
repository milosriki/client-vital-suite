import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Phone,
  Calendar,
  MessageSquare,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { QUERY_KEYS } from "@/config/queryKeys";

interface InterventionTrackerProps {
  interventions: any[];
  isLoading: boolean;
}

export function EnhancedInterventionTracker({ interventions, isLoading }: InterventionTrackerProps) {
  const queryClient = useQueryClient();
  const [selectedIntervention, setSelectedIntervention] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const logAiFeedback = async (intervention: any, feedbackNotes?: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id || intervention?.created_by || null;

      const { error } = await supabase.from("ai_feedback_learning").insert({
        feedback_type: "INTERVENTION",
        intervention_id: intervention?.id ?? null,
        original_recommendation: intervention?.ai_recommendation ?? null,
        feedback_notes: feedbackNotes ?? intervention?.outcome ?? null,
        created_by: createdBy,
      });

      if (error) {
        console.error("Failed to log AI feedback", error);
      }
    } catch (feedbackError) {
      console.error("AI feedback logging error", feedbackError);
    }
  };

  const getPriorityConfig = (priority: string | null) => {
    switch (priority) {
      case "CRITICAL":
        return { 
          badge: <Badge variant="destructive" className="animate-pulse">CRITICAL</Badge>,
          color: "border-l-destructive",
          bg: "bg-destructive/5"
        };
      case "HIGH":
        return { 
          badge: <Badge className="bg-orange-500">HIGH</Badge>,
          color: "border-l-orange-500",
          bg: "bg-orange-500/5"
        };
      case "MEDIUM":
        return { 
          badge: <Badge className="bg-warning text-warning-foreground">MEDIUM</Badge>,
          color: "border-l-warning",
          bg: "bg-warning/5"
        };
      default:
        return { 
          badge: <Badge variant="secondary">LOW</Badge>,
          color: "border-l-muted",
          bg: "bg-muted/5"
        };
    }
  };

  const getStatusConfig = (status: string | null) => {
    if (status === "COMPLETED") {
      return { 
        icon: <CheckCircle className="h-5 w-5 text-success" />,
        label: "Completed",
        color: "text-success"
      };
    }
    if (status === "IN_PROGRESS") {
      return { 
        icon: <Clock className="h-5 w-5 text-primary animate-pulse" />,
        label: "In Progress",
        color: "text-primary"
      };
    }
    return { 
      icon: <AlertTriangle className="h-5 w-5 text-warning" />,
      label: "Pending",
      color: "text-warning"
    };
  };

  const handleMarkExecuted = async (intervention: any) => {
    const { error } = await supabase
      .from("intervention_log")
      .update({
        status: "COMPLETED",
        actioned_at: new Date().toISOString(),
      })
      .eq("id", intervention.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Intervention completed" });
      await logAiFeedback(intervention);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.all });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.dashboard });
    }
  };

  const handleAddNotes = async () => {
    if (!selectedIntervention || !notes) return;

    const { error } = await supabase
      .from("intervention_log")
      .update({
        outcome: notes,
        completed_at: new Date().toISOString(),
      })
      .eq("id", selectedIntervention.id);

    if (error) {
      toast({ title: "Error", description: "Failed to add notes", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Notes added" });
      setNotes("");
      setSelectedIntervention(null);
      await logAiFeedback(selectedIntervention, notes);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.all });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.dashboard });
    }
  };

  // Group interventions by status
  const grouped = {
    pending: interventions.filter((i) => i.status !== "COMPLETED" && i.status !== "IN_PROGRESS"),
    inProgress: interventions.filter((i) => i.status === "IN_PROGRESS"),
    completed: interventions.filter((i) => i.status === "COMPLETED"),
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle>Intervention Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (interventions.length === 0) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle>Intervention Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-success opacity-50 mb-3" />
            <p className="font-medium">All Clear!</p>
            <p className="text-sm text-muted-foreground">No interventions needed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Intervention Tracker</span>
          <Badge variant="outline">{interventions.length} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Timeline View */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {/* Pending Section */}
            {grouped.pending.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 ml-12">
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                    {grouped.pending.length} Pending
                  </Badge>
                </div>
                {grouped.pending.slice(0, 5).map((intervention) => {
                  const priorityConfig = getPriorityConfig(intervention.priority);
                  const statusConfig = getStatusConfig(intervention.status);

                  return (
                    <div key={intervention.id} className="relative flex gap-4 pb-4">
                      {/* Timeline dot */}
                      <div className="relative z-10 flex items-center justify-center w-11 h-11 rounded-full bg-card border-2 border-warning">
                        {statusConfig.icon}
                      </div>

                      {/* Content */}
                      <div className={cn(
                        "flex-1 p-4 rounded-lg border-l-4 transition-all hover:shadow-md",
                        priorityConfig.color,
                        priorityConfig.bg
                      )}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">
                                {intervention.firstname} {intervention.lastname}
                              </h4>
                              {priorityConfig.badge}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {intervention.intervention_type}
                            </p>
                            {intervention.ai_recommendation && (
                              <div className="flex items-start gap-2 p-2 bg-primary/10 rounded text-sm">
                                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <span className="italic">{intervention.ai_recommendation}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleMarkExecuted(intervention)}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Complete
                            </Button>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <Calendar className="h-4 w-4" />
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => setSelectedIntervention(intervention)}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Add Notes</DialogTitle>
                                  </DialogHeader>
                                  <Textarea
                                    placeholder="Enter outcome notes..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={5}
                                  />
                                  <Button onClick={handleAddNotes} className="w-full">
                                    Save Notes
                                  </Button>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>
                            Created {formatDistanceToNow(new Date(intervention.triggered_at), { addSuffix: true })}
                          </span>
                          {intervention.success_probability && (
                            <span>Success: {intervention.success_probability.toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed Section (collapsed) */}
            {grouped.completed.length > 0 && (
              <div className="opacity-60">
                <div className="flex items-center gap-2 mb-3 ml-12">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                    {grouped.completed.length} Completed
                  </Badge>
                </div>
                {grouped.completed.slice(0, 2).map((intervention) => (
                  <div key={intervention.id} className="relative flex gap-4 pb-4">
                    <div className="relative z-10 flex items-center justify-center w-11 h-11 rounded-full bg-card border-2 border-success">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-success/5 border-l-4 border-l-success">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {intervention.firstname} {intervention.lastname}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(intervention.completed_at || intervention.actioned_at), "MMM d")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{intervention.intervention_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
