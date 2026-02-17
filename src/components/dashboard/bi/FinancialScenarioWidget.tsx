import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

interface Scenario {
  projected_revenue: string; // e.g., "$500,000"
  projected_profit: string;
  risk_factors: string[];
  strategic_move: string;
}

interface FinancialData {
  scenarios: {
    base_case: Scenario;
    bull_case: Scenario;
    bear_case: Scenario;
    cfo_commentary?: string;
  };
  metrics: {
    period: string;
    revenue: string;
    unit_economics: {
      cac: string;
      clv: string;
      ltv_cac_ratio: string;
    };
  };
}

export function FinancialScenarioWidget({ data }: { data: FinancialData }) {
  if (!data?.scenarios?.base_case) return null;

  const scenarios = [
    {
      type: "Bear Case",
      color: "text-red-400",
      bg: "bg-red-950/20",
      icon: ArrowDownRight,
      data: data.scenarios.bear_case,
    },
    {
      type: "Base Case",
      color: "text-gray-300",
      bg: "bg-gray-800/20",
      icon: TrendingUp,
      data: data.scenarios.base_case,
    },
    {
      type: "Bull Case",
      color: "text-emerald-400",
      bg: "bg-emerald-950/20",
      icon: ArrowUpRight,
      data: data.scenarios.bull_case,
    },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-medium text-foreground">
          Financial Scenario Planning
        </CardTitle>
        <Badge variant="outline" className="text-xs font-mono">
          LTV:CAC {data.metrics.unit_economics.ltv_cac_ratio}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CFO Commentary */}
        {data.scenarios.cfo_commentary && (
          <div className="p-3 rounded-md bg-indigo-950/30 border border-indigo-500/20 text-sm italic text-indigo-200">
            "{data.scenarios.cfo_commentary}"
          </div>
        )}

        {/* Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <div
              key={s.type}
              className={`p-4 rounded-lg border border-border ${s.bg}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-bold ${s.color}`}>{s.type}</span>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>

              <div className="mb-4">
                <div className="text-2xl font-mono font-bold text-foreground">
                  {s.data.projected_revenue}
                </div>
                <div className="text-xs text-muted-foreground">
                  Proj. Revenue
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">
                    Strategy
                  </span>
                  <p className="text-xs font-medium text-purple-200">
                    {s.data.strategic_move}
                  </p>
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">
                    Risks
                  </span>
                  <ul className="text-xs list-disc pl-4 text-red-200/70">
                    {s.data.risk_factors?.slice(0, 2).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
