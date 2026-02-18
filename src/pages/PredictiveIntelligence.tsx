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
} from "lucide-react";
import { usePredictions, type ClientPrediction } from "@/hooks/usePredictions";
import { format } from "date-fns";

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

// ── Format currency ──
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ── Main Page ──

export default function PredictiveIntelligence() {
  const { predictions, forecast } = usePredictions();

  if (predictions.isLoading || forecast.isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const clients = predictions.data ?? [];
  const fc = forecast.data;

  const avgChurn = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + c.churn_score, 0) / clients.length)
    : 0;
  const highRisk = clients.filter((c) => c.churn_score > 70).length;
  const revenueAtRisk30 = fc?.at_risk_30d ?? 0;
  const pipeline90 = fc ? (fc.revenue_30d + fc.revenue_60d + fc.revenue_90d) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <TrendingDown className="h-6 w-6 text-primary" />
          Predictive Intelligence
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-powered churn prediction & revenue forecasting
        </p>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Avg Churn Risk" value={avgChurn} icon={TrendingDown} color="orange" subtitle="Score 0-100" />
        <KpiCard title="High Risk Clients" value={highRisk} icon={AlertTriangle} color="red" subtitle="Score > 70" />
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
            Client Churn Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Churn Score</TableHead>
                  <TableHead>Risk Factors</TableHead>
                  <TableHead>Revenue at Risk</TableHead>
                  <TableHead>Last Session</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c: ClientPrediction) => (
                  <TableRow key={c.client_id}>
                    <TableCell className="font-medium">{c.client_name}</TableCell>
                    <TableCell><ChurnBar score={c.churn_score} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.churn_factors.days_since_last_session > 14 && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.churn_factors.days_since_last_session}d inactive
                          </Badge>
                        )}
                        {c.churn_factors.decline_rate > 0.3 && (
                          <Badge variant="outline" className="text-[10px]">Declining</Badge>
                        )}
                        {c.churn_factors.cancel_rate > 0.2 && (
                          <Badge variant="outline" className="text-[10px]">High cancels</Badge>
                        )}
                        {c.churn_factors.future_booked === 0 && (
                          <Badge variant="outline" className="text-[10px]">No bookings</Badge>
                        )}
                        {c.churn_factors.sessions_ratio < 0.2 && (
                          <Badge variant="outline" className="text-[10px]">Pack depleting</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{fmt(c.revenue_at_risk)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.churn_factors.days_since_last_session}d ago
                    </TableCell>
                    <TableCell className="text-sm">{c.churn_factors.coach ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.churn_factors.phone && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={`tel:${c.churn_factors.phone}`}>
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No predictions yet. Run the predict-churn edge function to generate data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
