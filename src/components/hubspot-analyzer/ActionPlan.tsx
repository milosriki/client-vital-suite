import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Recommendation } from "./types";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ActionPlanProps {
  recommendations: Recommendation[];
}

export const ActionPlan = ({ recommendations }: ActionPlanProps) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = async (title: string) => {
    setLoadingAction(title);
    try {
      // Simulate action execution or call edge function
      // In a real scenario, this would call a specific endpoint based on the action title

      // Example: Call auto-reassign-leads if title matches
      if (title.includes("Reassignment")) {
        const { error } = await supabase.functions.invoke(
          "auto-reassign-leads",
          {
            body: { reason: "MANUAL_TRIGGER_HUBSPOT_ANALYZER" },
          },
        );
        if (error) throw error;
      } else {
        // Simulate delay for other actions
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      toast.success("Action Executed Successfully", {
        description: `Started process: ${title}`,
      });
    } catch (error) {
      toast.error("Action Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prioritized Action Plan</CardTitle>
        <CardDescription>
          Recommendations ranked by impact and effort
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                      {rec.priority}
                    </Badge>
                    <h3 className="font-semibold">{rec.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {rec.description}
                  </p>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="font-medium">Effort:</span>{" "}
                      <Badge variant="outline">{rec.effort}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">Impact:</span>{" "}
                      <Badge
                        variant={
                          rec.impact === "Critical" ? "destructive" : "default"
                        }
                      >
                        {rec.impact}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    💰 {rec.revenue}
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => handleAction(rec.title)}
                disabled={loadingAction === rec.title}
              >
                {loadingAction === rec.title ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  "Take Action"
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
