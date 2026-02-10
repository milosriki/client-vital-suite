import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, MessageCircle } from "lucide-react";

interface CustomerData {
  segmentation: {
    champions: number;
    at_risk: number;
    sleeping: number;
    new_potential: number;
    total_analyzed: number;
  };
  ai_insights: {
    churn_analysis: string;
    retention_strategy: string;
    churn_signals: string[];
  };
}

export function CustomerVoiceWidget({ data }: { data: CustomerData }) {
  if (!data?.segmentation) return null;

  const total = data.segmentation.total_analyzed || 100;
  const segments = [
    {
      label: "Champions",
      count: data.segmentation.champions,
      color: "bg-emerald-500",
      text: "text-emerald-500",
    },
    {
      label: "New Potential",
      count: data.segmentation.new_potential,
      color: "bg-blue-500",
      text: "text-blue-500",
    },
    {
      label: "At Risk",
      count: data.segmentation.at_risk,
      color: "bg-amber-500",
      text: "text-amber-500",
    },
    {
      label: "Sleeping",
      count: data.segmentation.sleeping,
      color: "bg-red-500",
      text: "text-red-500",
    },
  ];

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" /> Customer Segments
        </CardTitle>
        <Badge variant="outline" className="text-xs font-mono">
          N={total}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Segmentation Bar */}
        <div className="space-y-2">
          <div className="flex h-4 w-full rounded-full overflow-hidden bg-secondary">
            {segments.map((s) => (
              <div
                key={s.label}
                className={`h-full ${s.color}`}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            {segments.map((s) => (
              <span
                key={s.label}
                className={`flex items-center gap-1 ${s.text}`}
              >
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                {s.label} ({s.count})
              </span>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-200">
              <AlertTriangle className="w-4 h-4" /> Retention Risk
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.ai_insights.churn_analysis}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-200">
              <MessageCircle className="w-4 h-4" /> Strategy
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.ai_insights.retention_strategy}
            </p>
          </div>
        </div>

        {/* Churn Signals */}
        <div>
          <span className="text-xs font-mono uppercase text-muted-foreground block mb-2">
            Watch for Churn Signals
          </span>
          <div className="flex flex-wrap gap-2">
            {data.ai_insights.churn_signals?.map((sig, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded bg-secondary text-xs text-secondary-foreground border border-border"
              >
                {sig}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
