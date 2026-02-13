import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  BarChart3,
  Activity,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

export default function AILearning() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch AI decisions
  const { data: decisions, isLoading } = useDedupedQuery({
    queryKey: ["ai-decisions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("agent_decisions")
        .select("id, decision_type, input_context, status, outcome, confidence_score, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Decisions query error:", error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch agent patterns for metrics
  const { data: patterns } = useDedupedQuery({
    queryKey: ["ai-patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_patterns")
        .select("id, pattern_name, confidence, usage_count, last_used_at")
        .order("last_used_at", { ascending: false })
        .limit(30);

      if (error) {
        console.warn("Patterns query error:", error);
        return [];
      }
      return data || [];
    },
  });

  // Calculate stats
  const stats = {
    total: decisions?.length || 0,
    successful:
      decisions?.filter((d) => d.outcome === "successful").length || 0,
    failed: decisions?.filter((d) => d.outcome === "failed").length || 0,
    pending: decisions?.filter((d) => d.status === "pending").length || 0,
  };

  const successRate =
    stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0;

  // Prepare chart data from patterns
  const chartData =
    patterns
      ?.slice(0, 10)
      .reverse()
      .map((p) => ({
        name: p.pattern_name?.substring(0, 15) || "Pattern",
        confidence: Math.round((p.confidence || 0) * 100),
        usage: p.usage_count || 0,
      })) || [];

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "in_progress":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "failed":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case "successful":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-rose-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-6">
      <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="bg-card border-border hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-blue-500" />
                Decision Engine
              </h1>
              <p className="text-muted-foreground text-sm">
                Real-time analysis of AI choices & patterns
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/ai-knowledge")}
            className="bg-card border-border hover:bg-accent hover:text-foreground gap-2"
          >
            <Brain className="h-4 w-4 text-purple-500" />
            Knowledge Graph
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Decisions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {stats.total}
                <Activity className="h-4 w-4 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">
                {successRate}%
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {patterns?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart & Table Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <Card className="lg:col-span-2 bg-card border-border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Confidence Trends
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pattern reliability over time
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="name"
                        stroke="#888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111",
                          borderColor: "#333",
                          color: "#fff",
                        }}
                        itemStyle={{ color: "#fff" }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="confidence"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        name="Confidence"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="usage"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        name="Usage"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">Not enough data points yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decisions Feed (Sidebar Style) */}
          <Card className="bg-card border-border shadow-sm flex flex-col h-[400px] lg:h-auto">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Recent Logic
                </CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs bg-background border-border">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Done</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <div className="divide-y divide-border/50">
                {isLoading ? (
                  <div className="p-4 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : decisions && decisions.length > 0 ? (
                  decisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="p-4 hover:bg-muted/5 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          {getOutcomeIcon(decision.outcome)}
                          {decision.decision_type || "Generic Decision"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {decision.created_at
                            ? format(new Date(decision.created_at), "HH:mm")
                            : ""}
                        </span>
                      </div>
                      <div className="ml-6">
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {typeof decision.input_context === "string"
                            ? decision.input_context
                            : JSON.stringify(decision.input_context).substring(
                                0,
                                80,
                              )}
                          ...
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`${getStatusColor(decision.status)} text-[10px] h-5 px-1.5`}
                          >
                            {decision.status}
                          </Badge>
                          {decision.confidence_score !== null && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(
                                (decision.confidence_score || 0) * 100,
                              )}
                              % Match
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No decisions logged yet.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
