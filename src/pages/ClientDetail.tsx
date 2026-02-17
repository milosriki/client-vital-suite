import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthScoreBadge } from "@/components/HealthScoreBadge";
import { TrendIndicator } from "@/components/TrendIndicator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Calendar,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

export default function ClientDetail() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();

  // Decode email parameter in case it has special characters
  const decodedEmail = email ? decodeURIComponent(email) : "";

  const { data: client, isLoading: clientLoading } = useDedupedQuery({
    queryKey: ["client", decodedEmail],
    queryFn: async () => {
      if (!decodedEmail) return null;

      const { data, error } = await supabase
        .from("client_health_scores")
        .select("id, email, firstname, lastname, health_score, health_zone, health_trend, churn_risk_score, outstanding_sessions, package_type, days_since_last_session, sessions_last_7d, sessions_last_30d, sessions_last_90d, engagement_score, momentum_score, package_health_score, relationship_score, financial_score, assigned_coach, package_value_aed, client_segment, intervention_priority, days_until_renewal, sessions_purchased, hubspot_contact_id, calculation_version, calculated_at")
        .eq("email", decodedEmail)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching client:", error);
        throw error;
      }
      return data;
    },
    enabled: !!decodedEmail,
  });

  const { data: interventions, isLoading: interventionsLoading } =
    useDedupedQuery({
      queryKey: ["interventions", decodedEmail],
      queryFn: async () => {
        if (!decodedEmail) return [];

        const { data, error } = await supabase
          .from("intervention_log")
          .select("id, intervention_type, intervention_date, triggered_at, status, priority, assigned_to, health_score_at_trigger, health_zone_at_trigger, ai_recommendation, outcome")
          .or(`client_email.eq.${decodedEmail},email.eq.${decodedEmail}`)
          .order("triggered_at", { ascending: false })
          .limit(5);

        if (error) {
          console.error("Error fetching interventions:", error);
          throw error;
        }
        return data || [];
      },
      enabled: !!decodedEmail,
    });

  if (clientLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-64 w-full mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/clients")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 text-center">
            <p className="text-lg">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName =
    `${client.firstname || ""} ${client.lastname || ""}`.trim() || decodedEmail;
  const displayEmail = (client as any).email || decodedEmail;

  const sessionData = [
    { period: "Last 7 Days", sessions: client.sessions_last_7d || 0 },
    { period: "Last 30 Days", sessions: client.sessions_last_30d || 0 },
    { period: "Last 90 Days", sessions: client.sessions_last_90d || 0 },
  ];

  const getScoreColor = (score: number | null) => {
    if (!score) return "#64748b"; // slate-500
    if (score < 50) return "#ef4444"; // red-500
    if (score < 75) return "#eab308"; // yellow-500
    return "#22c55e"; // green-500
  };

  const getTrendIcon = () => {
    if (client.health_trend === "IMPROVING")
      return <TrendingUp className="text-green-500" size={20} />;
    if (client.health_trend === "DECLINING")
      return <TrendingDown className="text-red-500" size={20} />;
    return <Minus className="text-gray-500" size={20} />;
  };

  const getChurnRiskLevel = (score: number | null) => {
    if (!score) return "Unknown";
    if (score < 30) return "Low";
    if (score < 60) return "Medium";
    return "High";
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      IN_PROGRESS: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      COMPLETED: "bg-green-500/20 text-green-400 border-green-500/50",
      FAILED: "bg-red-500/20 text-red-400 border-red-500/50",
    };
    return statusMap[status] || "bg-muted";
  };

  const getPriorityColor = (priority: string) => {
    const priorityMap: Record<string, string> = {
      CRITICAL: "bg-red-500/20 text-red-400 border-red-500/50",
      HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/50",
      MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      LOW: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    };
    return priorityMap[priority] || "bg-muted";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate("/clients")}
        className="mb-6 text-slate-300 hover:text-white"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Clients
      </Button>

      {/* Header Section */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{fullName}</h1>
              <p className="text-slate-400 mb-4">{displayEmail}</p>
              <div className="flex items-center gap-2">
                <Badge
                  className={`${
                    client.health_zone === "RED"
                      ? "bg-red-500"
                      : client.health_zone === "YELLOW"
                        ? "bg-yellow-500"
                        : client.health_zone === "GREEN"
                          ? "bg-green-500"
                          : "bg-purple-500"
                  }`}
                >
                  {client.health_zone}
                </Badge>
                <TrendIndicator trend={client.health_trend} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <HealthScoreBadge
                score={client.health_score || 0}
                zone={client.health_zone as any}
                size="lg"
              />
              <p className="text-xs text-slate-400">
                Updated{" "}
                {format(
                  new Date(client.calculated_at),
                  "MMM d, yyyy 'at' h:mm a",
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Health Score</p>
              {getTrendIcon()}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold">
                {client.health_score?.toFixed(0) || 0}
              </p>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {client.health_trend || "STABLE"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Churn Risk</p>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold">
              {client.churn_risk_score?.toFixed(0) || 0}%
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {getChurnRiskLevel(client.churn_risk_score)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Sessions Remaining</p>
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-3xl font-bold">
              {client.outstanding_sessions || 0}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {client.package_type || "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Days Since Last Session</p>
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-3xl font-bold">
              {client.days_since_last_session !== null
                ? client.days_since_last_session
                : "N/A"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {client.days_since_last_session === null
                ? ""
                : client.days_since_last_session > 30
                  ? "Inactive"
                  : client.days_since_last_session > 14
                    ? "At Risk"
                    : "Active"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dimensional Scores Section */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle>Dimensional Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Engagement Score</span>
              <span className="text-sm font-semibold">
                {client.engagement_score?.toFixed(0) || 0}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, client.engagement_score || 0)}%`,
                  backgroundColor: getScoreColor(client.engagement_score),
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Momentum Score</span>
              <span className="text-sm font-semibold">
                {client.momentum_score?.toFixed(0) || 0}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, client.momentum_score || 0)}%`,
                  backgroundColor: getScoreColor(client.momentum_score),
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">
                Package Health Score
              </span>
              <span className="text-sm font-semibold">
                {client.package_health_score?.toFixed(0) || 0}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, client.package_health_score || 0)}%`,
                  backgroundColor: getScoreColor(client.package_health_score),
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Relationship Score</span>
              <span className="text-sm font-semibold">
                {client.relationship_score?.toFixed(0) || 0}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, client.relationship_score || 0)}%`,
                  backgroundColor: getScoreColor(client.relationship_score),
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Financial Score</span>
              <span className="text-sm font-semibold">
                {client.financial_score?.toFixed(0) || 0}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, client.financial_score || 0)}%`,
                  backgroundColor: getScoreColor(client.financial_score),
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Activity Chart */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle>Session Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sessionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="period" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="sessions" radius={[8, 8, 0, 0]}>
                <Cell fill="#22c55e" />
                <Cell fill="#3b82f6" />
                <Cell fill="#a855f7" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Client Information */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Assigned Coach</p>
              <p className="font-semibold">
                {client.assigned_coach || "Not assigned"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Package Type</p>
              <p className="font-semibold">{client.package_type || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Package Value</p>
              <p className="font-semibold">
                {client.package_value_aed
                  ? `AED ${client.package_value_aed.toLocaleString()}`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Client Segment</p>
              <p className="font-semibold">{client.client_segment || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">
                Intervention Priority
              </p>
              <p className="font-semibold">
                {client.intervention_priority || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Days Until Renewal</p>
              <p className="font-semibold">
                {client.days_until_renewal !== null
                  ? client.days_until_renewal
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Sessions Purchased</p>
              <p className="font-semibold">
                {client.sessions_purchased || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">HubSpot Contact ID</p>
              <p className="font-semibold text-xs">
                {client.hubspot_contact_id || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Calculation Version</p>
              <p className="font-semibold">
                {client.calculation_version || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Interventions */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Recent Interventions</CardTitle>
        </CardHeader>
        <CardContent>
          {interventionsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : interventions && interventions.length > 0 ? (
            <div className="space-y-4">
              {interventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-lg">
                        {intervention.intervention_type}
                      </p>
                      <p className="text-sm text-slate-400">
                        {intervention.intervention_date
                          ? format(
                              new Date(intervention.intervention_date),
                              "MMM d, yyyy 'at' h:mm a",
                            )
                          : format(
                              new Date(intervention.triggered_at),
                              "MMM d, yyyy 'at' h:mm a",
                            )}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge
                        className={getStatusColor(
                          intervention.status || "PENDING",
                        )}
                      >
                        {intervention.status || "PENDING"}
                      </Badge>
                      {intervention.priority && (
                        <Badge
                          className={getPriorityColor(intervention.priority)}
                        >
                          {intervention.priority}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {intervention.ai_recommendation && (
                    <div className="mb-2 p-3 bg-slate-900/50 rounded">
                      <p className="text-xs text-slate-400 mb-1">
                        AI Recommendation:
                      </p>
                      <p className="text-sm text-slate-300">
                        {intervention.ai_recommendation}
                      </p>
                    </div>
                  )}

                  {intervention.outcome && (
                    <div className="mb-2 p-3 bg-slate-900/50 rounded">
                      <p className="text-xs text-slate-400 mb-1">Outcome:</p>
                      <p className="text-sm text-slate-300">
                        {intervention.outcome}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                    {intervention.assigned_to && (
                      <div>
                        <p className="text-xs text-slate-400">Assigned To:</p>
                        <p className="text-slate-300">
                          {intervention.assigned_to}
                        </p>
                      </div>
                    )}
                    {intervention.health_score_at_trigger !== null && (
                      <div>
                        <p className="text-xs text-slate-400">
                          Score at Trigger:
                        </p>
                        <p className="text-slate-300">
                          {Number(intervention?.health_score_at_trigger ?? 0).toFixed(0)}
                        </p>
                      </div>
                    )}
                    {intervention.health_zone_at_trigger && (
                      <div>
                        <p className="text-xs text-slate-400">
                          Zone at Trigger:
                        </p>
                        <Badge
                          className={`text-xs ${
                            intervention.health_zone_at_trigger === "RED"
                              ? "bg-red-500"
                              : intervention.health_zone_at_trigger === "YELLOW"
                                ? "bg-yellow-500"
                                : intervention.health_zone_at_trigger ===
                                    "GREEN"
                                  ? "bg-green-500"
                                  : "bg-purple-500"
                          }`}
                        >
                          {intervention.health_zone_at_trigger}
                        </Badge>
                      </div>
                    )}
                    {intervention.intervention_type && (
                      <div className="col-span-2 md:col-span-1">
                        <p className="text-xs text-slate-400">Trigger:</p>
                        <p className="text-slate-300 text-xs">
                          {intervention.intervention_type}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p>No interventions recorded for this client</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
