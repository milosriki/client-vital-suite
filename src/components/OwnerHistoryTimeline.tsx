import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCog, TrendingUp, TrendingDown, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface OwnerHistoryTimelineProps {
  clientEmail: string;
  limit?: number;
}

interface OwnerChange {
  id: string;
  old_owner: string | null;
  new_owner: string;
  changed_at: string;
  health_before: number | null;
  health_after: number | null;
  health_zone_before: string | null;
  health_zone_after: string | null;
  triggered_intervention: boolean;
  reason: string | null;
}

export function OwnerHistoryTimeline({ clientEmail, limit = 10 }: OwnerHistoryTimelineProps) {
  const { data: ownerHistory, isLoading } = useQuery({
    queryKey: ["owner-history", clientEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_owner_history")
        .select("*")
        .eq("client_email", clientEmail)
        .order("changed_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as OwnerChange[];
    },
    enabled: !!clientEmail,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!ownerHistory || ownerHistory.length === 0) {
    return null; // Don't show if no owner changes
  }

  const getHealthZoneColor = (zone: string | null) => {
    switch (zone) {
      case "GREEN":
        return "bg-success text-success-foreground";
      case "YELLOW":
        return "bg-warning text-warning-foreground";
      case "RED":
        return "bg-destructive text-destructive-foreground";
      case "PURPLE":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getHealthDelta = (change: OwnerChange) => {
    if (change.health_before === null || change.health_after === null) return null;
    return change.health_after - change.health_before;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          Owner Change History
        </CardTitle>
        <CardDescription>
          Timeline of coach/owner assignments and health impact
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-border" />

          {ownerHistory.map((change, index) => {
            const healthDelta = getHealthDelta(change);
            const hasHealthImpact = healthDelta !== null;

            return (
              <div key={change.id} className="relative pl-12">
                {/* Timeline dot */}
                <div className="absolute left-0 top-2 w-10 h-10 rounded-full border-2 bg-background flex items-center justify-center">
                  <UserCog className="h-5 w-5 text-primary" />
                </div>

                {/* Content */}
                <div className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  {/* Timestamp */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(change.changed_at), "MMM dd, yyyy 'at' HH:mm")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(change.changed_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Owner Change */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="font-normal">
                      {change.old_owner || "Unassigned"}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="default">{change.new_owner}</Badge>
                    {change.reason && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {change.reason.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>

                  {/* Health Impact */}
                  {hasHealthImpact && (
                    <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/50">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Before Change</div>
                        <div className="flex items-center gap-2">
                          {change.health_zone_before && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getHealthZoneColor(change.health_zone_before)}`}
                            >
                              {change.health_zone_before}
                            </Badge>
                          )}
                          <span className="font-mono font-semibold">
                            {change.health_before?.toFixed(1) || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">After Change</div>
                        <div className="flex items-center gap-2">
                          {change.health_zone_after && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getHealthZoneColor(change.health_zone_after)}`}
                            >
                              {change.health_zone_after}
                            </Badge>
                          )}
                          <span className="font-mono font-semibold">
                            {change.health_after?.toFixed(1) || "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Delta Badge */}
                      {healthDelta !== null && (
                        <div className="col-span-2 pt-2 border-t">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs text-muted-foreground">Impact:</span>
                            <Badge
                              variant={healthDelta >= 0 ? "default" : "destructive"}
                              className="gap-1 font-semibold"
                            >
                              {healthDelta >= 0 ? (
                                <>
                                  <TrendingUp className="h-3 w-3" />
                                  +{healthDelta.toFixed(1)}
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="h-3 w-3" />
                                  {healthDelta.toFixed(1)}
                                </>
                              )}
                            </Badge>
                            {healthDelta < -10 && (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertCircle className="h-3 w-3" />
                                Significant Drop
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Intervention Status */}
                  {change.triggered_intervention && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-muted-foreground">
                        Automatic intervention created for smooth transition
                      </span>
                    </div>
                  )}

                  {/* First assignment note */}
                  {index === ownerHistory.length - 1 && !change.old_owner && (
                    <div className="mt-2 text-xs text-muted-foreground italic">
                      Initial assignment
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {ownerHistory.length >= limit && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing last {limit} changes
          </div>
        )}
      </CardContent>
    </Card>
  );
}
