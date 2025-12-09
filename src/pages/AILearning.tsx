import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AILearning() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch AI decisions
  const { data: decisions, isLoading } = useQuery({
    queryKey: ["ai-decisions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("agent_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch AI metrics
  const { data: metrics } = useQuery({
    queryKey: ["ai-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_metrics")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const stats = {
    total: decisions?.length || 0,
    successful: decisions?.filter((d) => d.outcome === "successful").length || 0,
    failed: decisions?.filter((d) => d.outcome === "failed").length || 0,
    pending: decisions?.filter((d) => d.status === "pending").length || 0,
  };

  const successRate = stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0;

  // Prepare chart data
  const chartData = metrics
    ?.slice(0, 10)
    .reverse()
    .map((m) => ({
      date: format(new Date(m.recorded_at), "MM/dd"),
      accuracy: m.decision_accuracy || 0,
      responseTime: m.avg_response_time || 0,
    })) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500";
      case "in_progress":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case "successful":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              AI Learning Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track AI decision history and performance metrics
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/ai-knowledge")}
        >
          <Brain className="h-4 w-4 mr-2" />
          View Knowledge Base
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.successful}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            AI Performance Trends
          </CardTitle>
          <CardDescription>
            Decision accuracy and response time over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft" }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: "Response Time (ms)", angle: 90, position: "insideRight" }} />
                <Tooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Accuracy (%)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Response Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No performance data available yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decisions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Decision History</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : decisions && decisions.length > 0 ? (
              decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getOutcomeIcon(decision.outcome)}
                        <h3 className="font-semibold">
                          {decision.decision_type || "AI Decision"}
                        </h3>
                      </div>
                      {decision.context && (
                        <p className="text-sm text-muted-foreground">
                          Context: {typeof decision.context === "string" ? decision.context : JSON.stringify(decision.context)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getStatusColor(decision.status)}>
                        {decision.status}
                      </Badge>
                      {decision.confidence_score !== null && (
                        <span className="text-xs text-muted-foreground">
                          Confidence: {Math.round(decision.confidence_score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {decision.reasoning && (
                    <p className="text-sm mb-2">{decision.reasoning}</p>
                  )}

                  {decision.outcome_data && Object.keys(decision.outcome_data).length > 0 && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <p className="font-medium mb-1">Outcome Data:</p>
                      <pre className="overflow-auto">
                        {JSON.stringify(decision.outcome_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>
                      Created {format(new Date(decision.created_at), "PPp")}
                    </span>
                    {decision.outcome && (
                      <span className={decision.outcome === "successful" ? "text-green-600" : "text-red-600"}>
                        Outcome: {decision.outcome}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No decisions found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {statusFilter !== "all"
                    ? "Try adjusting your filter"
                    : "The AI hasn't made any decisions yet"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
