import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface HealthIntelligenceTabProps {
  mode: "test" | "live";
}

export default function HealthIntelligenceTab({ mode }: HealthIntelligenceTabProps) {
  const [coachFilter, setCoachFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const { toast } = useToast();

  // Fetch KPIs from company_health_aggregates view
  const { data: kpis } = useQuery({
    queryKey: ["company-health-aggregates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_health_aggregates")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch health scores
  const { data: healthScores, refetch } = useQuery({
    queryKey: ["health-scores", coachFilter, zoneFilter],
    queryFn: async () => {
      let query = supabase
        .from("health_scores")
        .select("*")
        .order("as_of", { ascending: false })
        .limit(100);

      if (zoneFilter !== "all") {
        query = query.eq("zone", zoneFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleRecalculate = async () => {
    try {
      const { error } = await supabase.rpc("calculate_daily_health_scores");
      if (error) throw error;
      toast({ title: "Success", description: "Health scores recalculated" });
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to recalculate", variant: "destructive" });
    }
  };

  const getZoneBadge = (zone: string) => {
    const colors = {
      red: "bg-red-500/10 text-red-500 border-red-500/20",
      yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      green: "bg-green-500/10 text-green-500 border-green-500/20",
      purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    };
    return <Badge variant="outline" className={colors[zone as keyof typeof colors]}>{zone?.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Company Avg Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis?.company_avg_score || "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Median Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis?.median_health_score || "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Std Deviation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis?.health_score_stdev || "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Red Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{kpis?.red_count || "0"}</p>
            <p className="text-xs text-muted-foreground">{kpis?.red_pct || "0"}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Yellow Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">{kpis?.yellow_count || "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Green Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{kpis?.green_count || "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Improving
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">↑ {kpis?.clients_improving || "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Declining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">↓ {kpis?.clients_declining || "0"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Client Health Scores</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={handleRecalculate}>
                Recalculate (Daily)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                <SelectItem value="red">Red</SelectItem>
                <SelectItem value="yellow">Yellow</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="purple">Purple</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Health Score</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Improving</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthScores?.map((score: any) => (
                  <TableRow key={score.id}>
                    <TableCell className="font-mono text-xs">
                      {score.client_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{score.as_of}</TableCell>
                    <TableCell className="font-medium">{score.health_score}</TableCell>
                    <TableCell>{score.risk_score}</TableCell>
                    <TableCell>{getZoneBadge(score.zone)}</TableCell>
                    <TableCell>
                      {score.improving ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">
                          ✓
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500">
                          ✗
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
