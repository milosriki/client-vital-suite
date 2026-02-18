import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Users,
  Phone,
  MessageCircle,
  ArrowUpDown,
  Calendar,
  Activity,
  Shield,
  Brain,
  Zap,
  BarChart3,
  Loader2,
} from "lucide-react";
import { usePredictions, type ClientPrediction } from "@/hooks/usePredictions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ── KPI Card ──

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: "emerald" | "blue" | "red" | "orange";
  subtitle?: string;
}) {
  const colorMap = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-400",
    orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className="h-8 w-8 opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Churn Score Bar ──

function ChurnBar({ score }: { score: number }) {
  const color = score > 70 ? "bg-red-500" : score > 40 ? "bg-orange-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right">{score}</span>
    </div>
  );
}

// ── ML Confidence Badge ──
function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (!confidence && confidence !== 0) return null;
  const color = confidence >= 80 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : confidence >= 50 ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
    : "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return (
    <Badge variant="outline" className={`text-[10px] ${color}`}>
      <Brain className="h-2.5 w-2.5 mr-0.5" />
      {confidence}%
    </Badge>
  );
}

// ── Feature Importance Bar Chart ──
function FeatureImportanceChart({ factors }: { factors: { factor: string; impact: number }[] }) {
  if (!factors?.length) return null;
  const maxImpact = Math.max(...factors.map(f => Math.abs(f.impact)), 0.01);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <BarChart3 className="h-4 w-4 text-primary" /> Feature Importance
      </p>
      {factors.map((f, i) => {
        const isPositive = f.impact > 0;
        const pct = Math.abs(f.impact) / maxImpact * 100;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-40 truncate" title={f.factor}>{f.factor}</span>
            <div className="flex-1 h-3 rounded bg-muted/30 overflow-hidden relative">
              <div
                className={`h-full rounded ${isPositive ? "bg-red-500/70" : "bg-emerald-500/70"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono w-10 text-right ${isPositive ? "text-red-400" : "text-emerald-400"}`}>
              {isPositive ? "+" : ""}{f.impact.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Format currency ──
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ── Sort types ──
type SortField = "churn_score" | "days_since_last_session" | "revenue_at_risk";
type SortDir = "asc" | "desc";

// ── Churn row color (pulsing for >80) ──
function getChurnRowClass(score: number) {
  if (score >= 80) return "bg-red-500/10 hover:bg-red-500/15 animate-pulse";
  if (score >= 70) return "bg-red-500/5 hover:bg-red-500/10";
  if (score >= 40) return "bg-yellow-500/5 hover:bg-yellow-500/10";
  return "hover:bg-muted/30";
}

function getChurnBadge(score: number) {
  if (score >= 80) return <Badge variant="destructive" className="text-xs animate-pulse">🔴 Critical</Badge>;
  if (score >= 70) return <Badge variant="destructive" className="text-xs">Critical</Badge>;
  if (score >= 40) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">Warning</Badge>;
  return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">Healthy</Badge>;
}

function getUrgencyBadge(urgency?: string) {
  switch (urgency) {
    case "CRITICAL": return <Badge variant="destructive" className="text-[10px]"><Zap className="h-2.5 w-2.5 mr-0.5" />CRITICAL</Badge>;
    case "HIGH": return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">HIGH</Badge>;
    case "MEDIUM": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">MEDIUM</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">LOW</Badge>;
  }
}

// ── Main Page ──

export default function PredictiveIntelligence() {
  const { predictions, forecast } = usePredictions();
  const [selectedClient, setSelectedClient] = useState<ClientPrediction | null>(null);
  const [sortField, setSortField] = useState<SortField>("churn_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [aiAdvisory, setAiAdvisory] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showActionPlan, setShowActionPlan] = useState(false);

  if (predictions.isLoading || forecast.isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const clients = predictions.data ?? [];
  const fc = forecast.data;

  const avgChurn = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + c.churn_score, 0) / clients.length)
    : 0;
  const highRisk = clients.filter((c) => c.churn_score > 70).length;
  const criticalRisk = clients.filter((c) => c.churn_score >= 80).length;
  const revenueAtRisk30 = fc?.at_risk_30d ?? 0;
  const pipeline90 = fc ? (fc.revenue_30d + fc.revenue_60d + fc.revenue_90d) : 0;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case "churn_score": aVal = a.churn_score; bVal = b.churn_score; break;
        case "days_since_last_session": aVal = a.churn_factors.days_since_last_session; bVal = b.churn_factors.days_since_last_session; break;
        case "revenue_at_risk": aVal = a.revenue_at_risk; bVal = b.revenue_at_risk; break;
        default: aVal = 0; bVal = 0;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [clients, sortField, sortDir]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={(e) => { e.stopPropagation(); toggleSort(field); }}
      className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors duration-200"
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
    </button>
  );

  const handleRowClick = (client: ClientPrediction) => {
    setSelectedClient(client);
    setAiAdvisory(null);
    setShowActionPlan(false);
  };

  const handleGetAIAdvice = async (clientName: string) => {
    setAiLoading(true);
    setShowActionPlan(true);
    try {
      // Find email from packages
      const { data: pkg } = await supabase
        .from("client_packages_live" as never)
        .select("client_email")
        .eq("client_name", clientName)
        .limit(1)
        .single();

      const email = (pkg as any)?.client_email;
      if (!email) {
        setAiAdvisory("Could not find client email. Please try again.");
        return;
      }

      const res = await fetch(
        `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ai-client-advisor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ client_email: email }),
        }
      );
      const data = await res.json();
      setAiAdvisory(data.advisory ?? "No advisory generated.");
      toast.success("AI action plan generated");
    } catch (err) {
      setAiAdvisory("Failed to generate AI advice. Please try again.");
      toast.error("Failed to get AI advice");
    } finally {
      setAiLoading(false);
    }
  };

  const getRecommendedAction = (c: ClientPrediction) => {
    // Use ML-generated action if available
    const mlAction = (c.churn_factors as any)?.recommended_action;
    if (mlAction) return mlAction;

    if (c.churn_score >= 70) {
      if (c.churn_factors.days_since_last_session > 21) return "Urgent: Schedule a personal check-in call immediately";
      if (c.churn_factors.future_booked === 0) return "Book a complimentary session to re-engage";
      return "Assign to retention specialist for immediate outreach";
    }
    if (c.churn_score >= 40) {
      if (c.churn_factors.decline_rate > 0.3) return "Review program fit — consider switching coach or modality";
      if (c.churn_factors.cancel_rate > 0.2) return "Address scheduling issues — offer flexible time slots";
      return "Send personalized progress update and milestone reminder";
    }
    return "Continue current engagement — monitor monthly";
  };

  const cf = selectedClient?.churn_factors as any;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            ML Predictive Intelligence
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Machine learning churn prediction with 33 features per client
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Brain className="h-3 w-3 mr-1" /> ML-Powered
        </Badge>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Avg Churn Risk" value={avgChurn} icon={TrendingDown} color="orange" subtitle="ML Score 0-100" />
        <KpiCard title="Critical Risk" value={criticalRisk} icon={AlertTriangle} color="red" subtitle="Score ≥ 80 (pulsing)" />
        <KpiCard title="High Risk" value={highRisk} icon={AlertTriangle} color="orange" subtitle="Score > 70" />
        <KpiCard title="Revenue at Risk (30d)" value={fmt(revenueAtRisk30)} icon={DollarSign} color="red" />
        <KpiCard title="Revenue Pipeline (90d)" value={fmt(pipeline90)} icon={Users} color="emerald" subtitle="With 65% renewal rate" />
      </div>

      {/* Revenue Forecast Section */}
      {fc && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Revenue Forecast</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "30-Day", revenue: fc.revenue_30d, atRisk: fc.at_risk_30d },
              { label: "60-Day", revenue: fc.revenue_60d, atRisk: fc.at_risk_60d },
              { label: "90-Day", revenue: fc.revenue_90d, atRisk: fc.at_risk_90d },
            ].map((w) => (
              <Card key={w.label} className="border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{w.label} Projection</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-400">{fmt(w.revenue)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Projected renewals</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">{fmt(w.atRisk)} at risk</Badge>
                  </div>
                  <Progress value={w.revenue / (w.revenue + w.atRisk) * 100 || 0} className="mt-3 h-1.5" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Churn Risk Table */}
      <Card className="border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            Client Churn Risk — ML Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead><SortButton field="churn_score">ML Score</SortButton></TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Risk Factors</TableHead>
                  <TableHead><SortButton field="revenue_at_risk">Revenue at Risk</SortButton></TableHead>
                  <TableHead><SortButton field="days_since_last_session">Last Session</SortButton></TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClients.map((c: ClientPrediction) => {
                  const factors = c.churn_factors as any;
                  return (
                    <TableRow
                      key={c.client_id}
                      className={`cursor-pointer transition-colors duration-200 ${getChurnRowClass(c.churn_score)}`}
                      onClick={() => handleRowClick(c)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.client_name}</span>
                          {getChurnBadge(c.churn_score)}
                        </div>
                      </TableCell>
                      <TableCell><ChurnBar score={c.churn_score} /></TableCell>
                      <TableCell>
                        <ConfidenceBadge confidence={factors?.ml_confidence} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(factors?.top_risk_factors ?? []).slice(0, 3).map((f: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>
                          ))}
                          {!(factors?.top_risk_factors?.length) && (
                            <>
                              {c.churn_factors.days_since_last_session > 14 && (
                                <Badge variant="outline" className="text-[10px]">
                                  {c.churn_factors.days_since_last_session}d inactive
                                </Badge>
                              )}
                              {c.churn_factors.future_booked === 0 && (
                                <Badge variant="outline" className="text-[10px]">No bookings</Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{fmt(c.revenue_at_risk)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.churn_factors.days_since_last_session}d ago
                      </TableCell>
                      <TableCell>
                        {getUrgencyBadge(factors?.action_urgency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {c.churn_factors.phone && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" asChild>
                                <a href={`tel:${c.churn_factors.phone}`}>
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" asChild>
                                <a
                                  href={`https://wa.me/${c.churn_factors.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-pointer text-primary"
                            onClick={() => {
                              handleRowClick(c);
                              handleGetAIAdvice(c.client_name);
                            }}
                          >
                            <Brain className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No predictions yet. Run the ML pipeline to generate data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              {selectedClient?.client_name} — ML Churn Analysis
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              {/* ML Scores Row */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">7-Day</p>
                  <p className={`text-2xl font-bold ${(cf?.ml_score_7d ?? 0) >= 70 ? "text-red-500" : "text-yellow-500"}`}>
                    {cf?.ml_score_7d ?? "?"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center border border-primary/30">
                  <p className="text-[10px] text-muted-foreground uppercase">30-Day</p>
                  <p className={`text-2xl font-bold ${selectedClient.churn_score >= 70 ? "text-red-500" : selectedClient.churn_score >= 40 ? "text-yellow-500" : "text-emerald-500"}`}>
                    {selectedClient.churn_score}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">90-Day</p>
                  <p className={`text-2xl font-bold ${(cf?.ml_score_90d ?? 0) >= 70 ? "text-red-500" : "text-yellow-500"}`}>
                    {cf?.ml_score_90d ?? "?"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Confidence</p>
                  <p className="text-2xl font-bold text-blue-400">{cf?.ml_confidence ?? "?"}%</p>
                </div>
              </div>

              <ChurnBar score={selectedClient.churn_score} />

              {/* Factors Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Days Since Last Session
                  </div>
                  <p className="text-lg font-bold">{selectedClient.churn_factors.days_since_last_session}d</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3.5 w-3.5" /> Revenue at Risk
                  </div>
                  <p className="text-lg font-bold text-red-400">{fmt(selectedClient.revenue_at_risk)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Activity className="h-3.5 w-3.5" /> Sessions Ratio
                  </div>
                  <p className="text-lg font-bold">{(selectedClient.churn_factors.sessions_ratio * 100).toFixed(0)}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Future Booked
                  </div>
                  <p className="text-lg font-bold">{selectedClient.churn_factors.future_booked}</p>
                </div>
              </div>

              {/* Feature Importance */}
              {cf?.feature_importance && (
                <FeatureImportanceChart factors={cf.feature_importance} />
              )}

              {/* Risk Factors */}
              <div>
                <p className="text-sm font-medium mb-2">Top Risk Factors (ML-identified)</p>
                <div className="flex flex-wrap gap-1.5">
                  {(cf?.top_risk_factors ?? []).map((f: string, i: number) => (
                    <Badge key={i} variant="destructive" className="text-xs">{f}</Badge>
                  ))}
                  {selectedClient.churn_factors.remaining_sessions !== undefined && (
                    <Badge variant="outline" className="text-xs">{selectedClient.churn_factors.remaining_sessions} sessions remaining</Badge>
                  )}
                </div>
              </div>

              {/* Predicted Churn Date */}
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Predicted Churn Date
                </div>
                <p className="font-medium">{selectedClient.predicted_churn_date ? new Date(selectedClient.predicted_churn_date).toLocaleDateString() : "—"}</p>
              </div>

              {/* Recommended Action */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Shield className="h-3.5 w-3.5" /> ML Recommended Action
                  </div>
                  {getUrgencyBadge(cf?.action_urgency)}
                </div>
                <p className="text-sm font-medium">{getRecommendedAction(selectedClient)}</p>
              </div>

              {/* AI Action Plan Button */}
              <Button
                className="w-full cursor-pointer"
                variant={showActionPlan ? "secondary" : "default"}
                onClick={() => handleGetAIAdvice(selectedClient.client_name)}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating AI Action Plan...</>
                ) : (
                  <><Brain className="h-4 w-4 mr-2" /> Get AI Action Plan</>
                )}
              </Button>

              {/* AI Advisory */}
              {showActionPlan && aiAdvisory && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 max-h-64 overflow-y-auto">
                  <p className="text-xs text-primary font-medium mb-2 flex items-center gap-1">
                    <Brain className="h-3 w-3" /> AI-Generated Action Plan
                  </p>
                  <div className="text-sm whitespace-pre-wrap">{aiAdvisory}</div>
                </div>
              )}

              {/* Contact Actions */}
              {selectedClient.churn_factors.phone && (
                <div className="flex gap-2">
                  <Button className="flex-1 cursor-pointer" variant="outline" asChild>
                    <a href={`tel:${selectedClient.churn_factors.phone}`}>
                      <Phone className="h-4 w-4 mr-2" /> Call Client
                    </a>
                  </Button>
                  <Button className="flex-1 cursor-pointer" variant="outline" asChild>
                    <a href={`https://wa.me/${selectedClient.churn_factors.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
