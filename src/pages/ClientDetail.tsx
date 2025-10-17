import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthScoreBadge } from "@/components/HealthScoreBadge";
import { TrendIndicator } from "@/components/TrendIndicator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, AlertTriangle, Calendar, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function ClientDetail() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("*")
        .eq("email", email)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!email,
  });

  const { data: interventions, isLoading: interventionsLoading } = useQuery({
    queryKey: ["interventions", email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_log")
        .select("*")
        .eq("client_email", email)
        .order("triggered_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!email,
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

  const fullName = `${client.firstname || ''} ${client.lastname || ''}`.trim() || client.email;
  
  const sessionData = [
    { period: "7 days", sessions: client.sessions_last_7d || 0 },
    { period: "30 days", sessions: client.sessions_last_30d || 0 },
    { period: "90 days", sessions: client.sessions_last_90d || 0 },
  ];

  const getScoreColor = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score < 50) return "bg-red-500";
    if (score < 75) return "bg-yellow-500";
    return "bg-green-500";
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
              <p className="text-slate-400 mb-4">{client.email}</p>
              <div className="flex items-center gap-2">
                <Badge className={`${
                  client.health_zone === 'RED' ? 'bg-red-500' :
                  client.health_zone === 'YELLOW' ? 'bg-yellow-500' :
                  client.health_zone === 'GREEN' ? 'bg-green-500' :
                  'bg-purple-500'
                }`}>
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
                Updated {format(new Date(client.calculated_at), "MMM d, yyyy 'at' h:mm a")}
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
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold">{client.health_score?.toFixed(0) || 0}</p>
              <TrendIndicator trend={client.health_trend} size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Churn Risk</p>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold">{client.churn_risk_score?.toFixed(0) || 0}%</p>
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
            <p className="text-3xl font-bold">{client.outstanding_sessions || 0}</p>
            <p className="text-sm text-slate-400 mt-1">{client.package_type || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Last Session</p>
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-3xl font-bold">{client.days_since_last_session || 0}</p>
            <p className="text-sm text-slate-400 mt-1">days ago</p>
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
              <span className="text-sm font-semibold">{client.engagement_score?.toFixed(0) || 0}</span>
            </div>
            <Progress 
              value={client.engagement_score || 0} 
              className={`h-3 ${getScoreColor(client.engagement_score)}`}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Momentum Score</span>
              <span className="text-sm font-semibold">{client.momentum_score?.toFixed(0) || 0}</span>
            </div>
            <Progress 
              value={client.momentum_score || 0} 
              className={`h-3 ${getScoreColor(client.momentum_score)}`}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Package Health Score</span>
              <span className="text-sm font-semibold">{client.package_health_score?.toFixed(0) || 0}</span>
            </div>
            <Progress 
              value={client.package_health_score || 0} 
              className={`h-3 ${getScoreColor(client.package_health_score)}`}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Relationship Score</span>
              <span className="text-sm font-semibold">{client.relationship_score?.toFixed(0) || 0}</span>
            </div>
            <Progress 
              value={client.relationship_score || 0} 
              className={`h-3 ${getScoreColor(client.relationship_score)}`}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Financial Score</span>
              <span className="text-sm font-semibold">{client.financial_score?.toFixed(0) || 0}</span>
            </div>
            <Progress 
              value={client.financial_score || 0} 
              className={`h-3 ${getScoreColor(client.financial_score)}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Session Activity Chart */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle>Session Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={sessionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="period" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="sessions" 
                stroke="#22c55e" 
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Client Information */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Assigned Coach</p>
              <p className="font-semibold">{client.assigned_coach || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Package Type</p>
              <p className="font-semibold">{client.package_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Package Value</p>
              <p className="font-semibold">
                {client.package_value_aed ? `${client.package_value_aed} AED` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Client Segment</p>
              <p className="font-semibold">{client.client_segment || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Intervention Priority</p>
              <p className="font-semibold">{client.intervention_priority || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Days Until Renewal</p>
              <p className="font-semibold">{client.days_until_renewal || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Interventions */}
      {interventions && interventions.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle>Recent Interventions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {interventions.map((intervention) => (
                <div 
                  key={intervention.id} 
                  className="border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold">{intervention.intervention_type}</p>
                      <p className="text-sm text-slate-400">
                        {format(new Date(intervention.triggered_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge className={getStatusColor(intervention.status || 'PENDING')}>
                      {intervention.status}
                    </Badge>
                  </div>
                  {intervention.ai_recommendation && (
                    <p className="text-sm text-slate-300 mb-2">
                      <span className="text-slate-400">AI Recommendation: </span>
                      {intervention.ai_recommendation}
                    </p>
                  )}
                  {intervention.outcome && (
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-400">Outcome: </span>
                      {intervention.outcome}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
