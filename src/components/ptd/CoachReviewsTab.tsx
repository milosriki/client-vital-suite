import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";

interface CoachReviewsTabProps {
  mode: "test" | "live";
}

export default function CoachReviewsTab({ mode }: CoachReviewsTabProps) {
  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: ["coach-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: performance } = useQuery({
    queryKey: ["coach-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_performance")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Coach Performance Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Coach Performance</CardTitle>
              <CardDescription>Latest performance metrics by coach</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {performance && performance.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coach</TableHead>
                    <TableHead>Report Date</TableHead>
                    <TableHead>Total Clients</TableHead>
                    <TableHead>Avg Health</TableHead>
                    <TableHead>Zone Distribution</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>At Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.map((perf: any) => (
                    <TableRow key={perf.id}>
                      <TableCell className="font-semibold">{perf.coach_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(perf.report_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{perf.total_clients}</span>
                          <span className="text-xs text-muted-foreground">
                            ({perf.active_clients} active)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {perf.avg_client_health?.toFixed(1) || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {perf.clients_green > 0 && (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              G:{perf.clients_green}
                            </Badge>
                          )}
                          {perf.clients_yellow > 0 && (
                            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                              Y:{perf.clients_yellow}
                            </Badge>
                          )}
                          {perf.clients_red > 0 && (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                              R:{perf.clients_red}
                            </Badge>
                          )}
                          {perf.clients_purple > 0 && (
                            <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                              P:{perf.clients_purple}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {perf.health_trend === "improving" ? (
                          <div className="flex items-center gap-1 text-green-500">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-xs">Improving</span>
                          </div>
                        ) : perf.health_trend === "declining" ? (
                          <div className="flex items-center gap-1 text-red-500">
                            <TrendingDown className="h-4 w-4" />
                            <span className="text-xs">Declining</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Stable</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">{perf.clients_at_risk || 0}</div>
                          {perf.at_risk_revenue_aed && (
                            <div className="text-xs text-muted-foreground">
                              AED {perf.at_risk_revenue_aed.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No performance data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Reviews Archive */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Review Archive</CardTitle>
          <CardDescription>Historical monthly coach review summaries</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading reviews...</div>
          ) : reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <Card key={review.id} className="bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{review.coach}</CardTitle>
                        <CardDescription>
                          {review.period_month}/{review.period_year}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">
                        {new Date(review.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-2xl font-bold">
                          {review.summary?.total_clients || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Total Clients</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-500">
                          {review.summary?.greens || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Green Zone</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-500">
                          {review.summary?.yellows || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Yellow Zone</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-500">
                          {review.summary?.reds || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Red Zone</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No reviews found. Run monthly review in Automation tab to generate.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
