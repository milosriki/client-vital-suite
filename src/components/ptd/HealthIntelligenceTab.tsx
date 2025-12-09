import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Brain, AlertTriangle, Activity, Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface HealthIntelligenceTabProps {
  mode: "test" | "live";
}

export default function HealthIntelligenceTab({ mode }: HealthIntelligenceTabProps) {
  const [zoneFilter, setZoneFilter] = useState("all");
  const { toast } = useToast();

  // Fetch client health scores from Supabase
  const { data: healthScores, refetch, isLoading } = useQuery({
    queryKey: ["client-health-scores", zoneFilter],
    queryFn: async () => {
      let query = supabase
        .from("client_health_scores")
        .select("*")
        .order("health_score", { ascending: true })
        .limit(100);

      if (zoneFilter !== "all") {
        query = query.eq("health_zone", zoneFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate health scores using edge function
  const calculateHealth = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('health-calculator', {
        body: { mode, action: 'calculate-all' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Health scores calculated: ${data?.processed || 0} clients processed` });
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to calculate health scores", variant: "destructive" });
    }
  });

  // Predict churn using edge function
  const predictChurn = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('churn-predictor', {
        body: { mode, action: 'predict-all' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Churn Analysis Complete", description: `${data?.atRisk || 0} clients at risk identified` });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run churn prediction", variant: "destructive" });
    }
  });

  // Detect anomalies using edge function
  const detectAnomalies = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('anomaly-detector', {
        body: { mode, action: 'detect' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Anomaly Detection Complete", description: `${data?.anomalies?.length || 0} anomalies found` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to detect anomalies", variant: "destructive" });
    }
  });

  // Get intervention recommendations
  const getRecommendations = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('intervention-recommender', {
        body: { mode, action: 'recommend-all' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Recommendations Generated", description: `${data?.recommendations?.length || 0} interventions recommended` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate recommendations", variant: "destructive" });
    }
  });

  // Summary stats
  const stats = {
    total: healthScores?.length || 0,
    red: healthScores?.filter((c: any) => c.health_zone === 'red').length || 0,
    yellow: healthScores?.filter((c: any) => c.health_zone === 'yellow').length || 0,
    green: healthScores?.filter((c: any) => c.health_zone === 'green').length || 0,
    purple: healthScores?.filter((c: any) => c.health_zone === 'purple').length || 0,
    avgScore: healthScores?.length ? 
      (healthScores.reduce((acc: number, c: any) => acc + (c.health_score || 0), 0) / healthScores.length).toFixed(1) : 0,
  };

  const getZoneBadge = (zone: string) => {
    const colors: Record<string, string> = {
      red: "bg-red-500/10 text-red-500 border-red-500/20",
      yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      green: "bg-green-500/10 text-green-500 border-green-500/20",
      purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    };
    return <Badge variant="outline" className={colors[zone] || ""}>{zone?.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => calculateHealth.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Calculate Health</p>
                <p className="text-xs text-muted-foreground">Run health-calculator</p>
              </div>
            </div>
            {calculateHealth.isPending && <p className="text-xs mt-2 text-muted-foreground">Processing...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => predictChurn.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-semibold">Predict Churn</p>
                <p className="text-xs text-muted-foreground">Run churn-predictor</p>
              </div>
            </div>
            {predictChurn.isPending && <p className="text-xs mt-2 text-muted-foreground">Processing...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => detectAnomalies.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-semibold">Detect Anomalies</p>
                <p className="text-xs text-muted-foreground">Run anomaly-detector</p>
              </div>
            </div>
            {detectAnomalies.isPending && <p className="text-xs mt-2 text-muted-foreground">Processing...</p>}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => getRecommendations.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Brain className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">Get Interventions</p>
                <p className="text-xs text-muted-foreground">Run intervention-recommender</p>
              </div>
            </div>
            {getRecommendations.isPending && <p className="text-xs mt-2 text-muted-foreground">Processing...</p>}
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.avgScore}</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500">Red Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{stats.red}</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-500">Yellow Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">{stats.yellow}</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-500">Green Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{stats.green}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-500">Purple Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-500">{stats.purple}</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Health Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Client Health Scores</CardTitle>
            <div className="flex gap-2">
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="yellow">Yellow</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : healthScores && healthScores.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Health Score</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Churn Risk</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Coach</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthScores.map((client: any) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.firstname} {client.lastname}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {client.email}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-lg">{client.health_score || 0}</span>
                      </TableCell>
                      <TableCell>{getZoneBadge(client.health_zone)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={client.churn_risk_score > 50 ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}>
                          {client.churn_risk_score?.toFixed(0) || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {client.health_trend === 'improving' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : client.health_trend === 'declining' ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{client.assigned_coach || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No health data found. Click "Calculate Health" to generate scores.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}