import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Clock, Users, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LeadsNotReachedProps {
  daysThreshold?: number; // Show leads not contacted in X+ days
}

export const LeadsNotReached = ({ daysThreshold = 7 }: LeadsNotReachedProps) => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["leads-not-reached", daysThreshold],
    queryFn: async () => {
      // Query for leads not contacted in X+ days
      const { data: leads, error } = await supabase
        .from("client_health_scores")
        .select("*")
        .gte("days_since_last_session", daysThreshold)
        .in("health_zone", ["RED", "YELLOW", "ORANGE"])
        .order("predictive_risk_score", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by owner
      const byOwner = new Map<string, any[]>();
      leads?.forEach((lead) => {
        const owner = lead.hubspot_owner_name || lead.assigned_coach || "Unassigned";
        if (!byOwner.has(owner)) {
          byOwner.set(owner, []);
        }
        byOwner.get(owner)?.push(lead);
      });

      // Calculate stats
      const stats = Array.from(byOwner.entries()).map(([owner, ownerLeads]) => {
        const urgent = ownerLeads.filter(l => l.health_zone === "RED").length;
        const high = ownerLeads.filter(l => l.predictive_risk_score >= 60).length;
        const avgDays = ownerLeads.reduce((sum, l) => sum + (l.days_since_last_session || 0), 0) / ownerLeads.length;

        return {
          owner,
          total: ownerLeads.length,
          urgent,
          high,
          avgDays: Math.round(avgDays)
        };
      });

      // Sort by total (highest first)
      stats.sort((a, b) => b.total - a.total);

      return {
        totalLeads: leads?.length || 0,
        byOwner: stats,
        leads: leads || []
      };
    },
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  const handleViewQueue = (owner: string) => {
    // Navigate to SetterActivityToday with owner filter
    navigate(`/setter-activity-today?owner=${encodeURIComponent(owner)}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Leads Not Reached
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const totalLeads = data?.totalLeads || 0;
  const byOwner = data?.byOwner || [];

  return (
    <Card className={totalLeads > 0 ? "border-warning" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Leads Not Reached ({daysThreshold}+ Days)
            </CardTitle>
            <CardDescription>
              Clients not contacted in {daysThreshold}+ days requiring attention
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-warning">{totalLeads}</div>
            <div className="text-xs text-muted-foreground">Total Leads</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {totalLeads === 0 ? (
          <Alert>
            <Clock className="h-4 w-4 text-success" />
            <AlertDescription>
              All caught up! No leads have gone {daysThreshold}+ days without contact. Great work!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {/* Breakdown by Owner */}
            <div className="space-y-2">
              <div className="text-sm font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Breakdown by Contact Owner
              </div>

              {byOwner.map((stat) => (
                <div
                  key={stat.owner}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{stat.owner}</div>
                      {stat.urgent > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {stat.urgent} urgent
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{stat.total} leads</span>
                      <span>•</span>
                      <span>{stat.high} high risk</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Avg {stat.avgDays} days
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewQueue(stat.owner)}
                  >
                    View Queue
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {data?.leads.filter(l => l.health_zone === "RED").length || 0}
                </div>
                <div className="text-xs text-muted-foreground">RED Zone</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {data?.leads.filter(l => l.predictive_risk_score >= 60).length || 0}
                </div>
                <div className="text-xs text-muted-foreground">High Risk</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {data?.leads.filter(l => l.pattern_status === "PATTERN_BREAK").length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Pattern Break</div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <Button
                className="w-full"
                variant="default"
                onClick={() => navigate("/setter-activity-today")}
              >
                View Full Call Queue
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadsNotReached;
