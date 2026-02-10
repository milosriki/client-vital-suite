import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { getBusinessDate } from "@/lib/date-utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnnounce } from "@/lib/accessibility";

const Interventions = () => {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    data: interventions,
    isLoading,
    refetch,
  } = useDedupedQuery({
    queryKey: ["interventions-all", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("intervention_log")
        .select("*")
        .order("triggered_at", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const getPriorityColor = (priority: string | null) => {
    switch (priority?.toUpperCase()) {
      case "CRITICAL":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const handleMarkComplete = async (interventionId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("intervention_log")
        .update({
          status: "COMPLETED",
          completed_at: getBusinessDate().toISOString(),
        })
        .eq("id", interventionId);

      if (error) throw error;
      toast.success("Intervention marked as complete");
      refetch();
    } catch (err: any) {
      toast.error("Failed to update intervention: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async (interventionId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("intervention_log")
        .update({ status: "CANCELLED" })
        .eq("id", interventionId);

      if (error) throw error;
      toast.success("Intervention cancelled");
      refetch();
    } catch (err: any) {
      toast.error("Failed to cancel intervention: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenNotesDialog = (intervention: any) => {
    setSelectedIntervention(intervention);
    setNotes(intervention.notes || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedIntervention) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("intervention_log")
        .update({ notes })
        .eq("id", selectedIntervention.id);

      if (error) throw error;
      toast.success("Notes saved successfully");
      setNotesDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast.error("Failed to save notes: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const pendingCritical =
    interventions?.filter(
      (i) => i.status === "PENDING" && i.priority === "CRITICAL",
    ).length || 0;
  const pendingHigh =
    interventions?.filter(
      (i) => i.status === "PENDING" && i.priority === "HIGH",
    ).length || 0;
  const completed =
    interventions?.filter((i) => i.status === "COMPLETED").length || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Interventions</h1>
            <p className="text-muted-foreground">
              Track and manage client interventions
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Critical Pending
                  </p>
                  <p className="text-3xl font-bold text-red-500">
                    {pendingCritical}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    High Priority
                  </p>
                  <p className="text-3xl font-bold text-orange-500">
                    {pendingHigh}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Completed
                  </p>
                  <p className="text-3xl font-bold text-green-500">
                    {completed}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {["ALL", "PENDING", "COMPLETED", "CANCELLED"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Interventions List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : interventions?.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No interventions found</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {interventions?.map((intervention) => (
              <Card key={intervention.id} className="card-hover">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(intervention.status)}
                        <CardTitle className="text-lg">
                          {intervention.email}
                        </CardTitle>
                        {intervention.priority && (
                          <Badge
                            className={`${getPriorityColor(intervention.priority)} text-white border-none`}
                          >
                            {intervention.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {intervention.email}
                      </p>
                    </div>
                    <Badge variant="outline">{intervention.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {intervention.intervention_type && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Type
                      </p>
                      <p className="text-sm">
                        {intervention.intervention_type}
                      </p>
                    </div>
                  )}

                  {intervention.trigger_reason && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Trigger Reason
                      </p>
                      <p className="text-sm">{intervention.trigger_reason}</p>
                    </div>
                  )}

                  {intervention.ai_recommendation && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        AI Recommendation
                      </p>
                      <p className="text-sm">
                        {intervention.ai_recommendation}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {intervention.health_score_at_trigger !== null && (
                      <div>
                        <p className="text-muted-foreground">Health Score</p>
                        <p className="font-semibold">
                          {intervention.health_score_at_trigger.toFixed(1)}
                        </p>
                      </div>
                    )}
                    {intervention.assigned_to && (
                      <div>
                        <p className="text-muted-foreground">Assigned To</p>
                        <p className="font-semibold">
                          {intervention.assigned_to}
                        </p>
                      </div>
                    )}
                    {intervention.triggered_at && (
                      <div>
                        <p className="text-muted-foreground">Triggered</p>
                        <p className="font-semibold">
                          {format(
                            new Date(intervention.triggered_at),
                            "MMM d, yyyy",
                          )}
                        </p>
                      </div>
                    )}
                    {intervention.completed_at && (
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-semibold">
                          {format(
                            new Date(intervention.completed_at),
                            "MMM d, yyyy",
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {intervention.status === "PENDING" && (
                    <div className="flex gap-2 pt-4">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isUpdating}
                        onClick={() => handleMarkComplete(intervention.id)}
                      >
                        Mark Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUpdating}
                        onClick={() => handleOpenNotesDialog(intervention)}
                      >
                        Add Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isUpdating}
                        onClick={() => handleCancel(intervention.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Notes</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter notes for this intervention..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotes} disabled={isUpdating}>
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Interventions;
