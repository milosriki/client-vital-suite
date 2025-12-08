import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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

interface Decision {
  id: string;
  agent_type: string;
  decision_type: string;
  input_context: any;
  decision: any;
  reasoning: string | null;
  confidence: number | null;
  client_email: string | null;
  coach_name: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  outcome_metrics: any;
  was_helpful: boolean | null;
  feedback_notes: string | null;
  created_at: string;
}

export default function AILearning() {
  const navigate = useNavigate();
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [decisionTypeFilter, setDecisionTypeFilter] = useState<string>("all");

  // Fetch decisions
  const { data: decisions, isLoading } = useQuery({
    queryKey: ["agent-decisions"],
    queryFn: async (): Promise<Decision[]> => {
      try {
        const { data, error } = await (supabase as any)
          .from("agent_decisions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.info("agent_decisions table not yet created");
            return [];
          }
          throw error;
        }

        return (data || []) as Decision[];
      } catch (e) {
        console.error("Error fetching decisions:", e);
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Filter decisions
  const filteredDecisions = decisions?.filter((d) => {
    const outcomeMatch = outcomeFilter === "all" || d.outcome === outcomeFilter;
    const typeMatch =
      decisionTypeFilter === "all" || d.decision_type === decisionTypeFilter;
    return outcomeMatch && typeMatch;
  }) || [];

  // Calculate metrics
  const totalDecisions = decisions?.length || 0;
  const successfulDecisions =
    decisions?.filter((d) => d.outcome === "successful").length || 0;
  const failedDecisions =
    decisions?.filter((d) => d.outcome === "failed").length || 0;
  const pendingDecisions =
    decisions?.filter((d) => d.outcome === "pending").length || 0;
  const successRate =
    totalDecisions > 0
      ? ((successfulDecisions / (successfulDecisions + failedDecisions)) * 100).toFixed(1)
      : "0.0";
  const avgConfidence =
    decisions && decisions.length > 0
      ? (
          decisions
            .filter((d) => d.confidence !== null)
            .reduce((acc, d) => acc + (d.confidence || 0), 0) / decisions.length
        ).toFixed(2)
      : "0.00";

  // Get unique decision types
  const decisionTypes = Array.from(
    new Set(decisions?.map((d) => d.decision_type) || [])
  );

  // Prepare timeline data
  const timelineData = decisions
    ?.reduce((acc: any[], decision) => {
      const date = format(new Date(decision.created_at), "MMM dd");
      const existing = acc.find((item) => item.date === date);
      if (existing) {
        existing.count += 1;
        if (decision.outcome === "successful") existing.successful += 1;
      } else {
        acc.push({
          date,
          count: 1,
          successful: decision.outcome === "successful" ? 1 : 0,
        });
      }
      return acc;
    }, [])
    .reverse() || [];

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case "successful":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getOutcomeBadgeVariant = (outcome: string | null) => {
    switch (outcome) {
      case "successful":
        return "default";
      case "failed":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
                <Brain className="h-8 w-8 text-primary" />
                AI Learning Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Track AI decisions, outcomes, and performance over time
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Decisions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDecisions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Successful
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {successfulDecisions}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-600" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {failedDecisions}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {successRate}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgConfidence}</div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Decision Timeline
            </CardTitle>
            <CardDescription>Decisions made over time</CardDescription>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8884d8"
                    name="Total Decisions"
                  />
                  <Line
                    type="monotone"
                    dataKey="successful"
                    stroke="#22c55e"
                    name="Successful"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No decision data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="successful">Successful</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={decisionTypeFilter}
                onValueChange={setDecisionTypeFilter}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {decisionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Decision History */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDecisions.length === 0 ? (
          <Card className="p-12 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No decisions found. The AI will start making decisions as you use it.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDecisions.map((decision) => (
              <Card key={decision.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getOutcomeIcon(decision.outcome)}
                        {decision.decision_type.charAt(0).toUpperCase() +
                          decision.decision_type.slice(1)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {decision.agent_type} • {format(new Date(decision.created_at), "PPp")}
                      </CardDescription>
                    </div>
                    <Badge variant={getOutcomeBadgeVariant(decision.outcome) as any}>
                      {decision.outcome || "unknown"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {decision.reasoning && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Reasoning:</h4>
                      <p className="text-sm text-muted-foreground">
                        {decision.reasoning}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {decision.confidence !== null && (
                      <div>
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="ml-2 font-semibold">
                          {(decision.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {decision.client_email && (
                      <div>
                        <span className="text-muted-foreground">Client:</span>
                        <span className="ml-2 font-semibold">
                          {decision.client_email}
                        </span>
                      </div>
                    )}
                    {decision.coach_name && (
                      <div>
                        <span className="text-muted-foreground">Coach:</span>
                        <span className="ml-2 font-semibold">
                          {decision.coach_name}
                        </span>
                      </div>
                    )}
                  </div>

                  {decision.decision && Object.keys(decision.decision).length > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs font-semibold mb-2">Decision Details:</p>
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(decision.decision, null, 2)}
                      </pre>
                    </div>
                  )}

                  {decision.outcome_notes && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs font-semibold mb-2">Outcome Notes:</p>
                      <p className="text-sm">{decision.outcome_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
