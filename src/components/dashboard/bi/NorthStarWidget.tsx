import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radar, AlertOctagon, CheckCircle2 } from "lucide-react";

interface OKR {
  metric: string;
  target: number;
  current: number;
  status: string;
}

interface Anomaly {
  metric: string;
  value: number;
  mean: number;
  deviation: string; // Z-Score
  severity: "CRITICAL" | "WARNING";
}

interface StrategyData {
  okrs: {
    objective: string;
    key_results: OKR[];
  };
  anomalies: Anomaly[];
  strategic_advice: {
    strategy_pulse: string;
    north_star_recommendation: string;
  };
}

export function NorthStarWidget({ data }: { data: StrategyData }) {
  if (!data?.okrs) return null;

  const arrMetric = data.okrs.key_results.find(
    (k) => k.metric === "total_revenue_booked",
  );
  const progress = arrMetric ? (arrMetric.current / arrMetric.target) * 100 : 0;

  return (
    <Card className="border-border bg-card h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
          <Radar className="w-5 h-5 text-purple-400" /> Strategic Command
        </CardTitle>
        <Badge
          variant={data.anomalies.length > 0 ? "destructive" : "outline"}
          className="text-xs font-mono"
        >
          {data.anomalies.length} Anomalies
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        {/* North Star Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">North Star: 500k ARR</span>
            <span className="text-foreground font-bold">
              {progress.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Strategy Pulse */}
        <div className="p-3 bg-secondary/50 rounded-lg border border-border">
          <h4 className="text-xs font-semibold uppercase text-purple-200 mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3" /> CSO Pulse
          </h4>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {data.strategic_advice.strategy_pulse}
          </p>
        </div>

        {/* Anomaly Feed */}
        <div className="space-y-2">
          <span className="text-xs font-mono uppercase text-muted-foreground block">
            Anomaly Detection (Z-Score &gt; 2)
          </span>
          {data.anomalies.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">
              System Nominal. No deviations detected.
            </div>
          ) : (
            <div className="space-y-2">
              {data.anomalies.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded bg-red-950/20 border border-red-900/30"
                >
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-red-500" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-red-200">
                        {a.metric}
                      </span>
                      <span className="text-[10px] text-red-300/70">
                        Expected: {a.mean} | Actual: {a.value}
                      </span>
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    {a.deviation}σ
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
