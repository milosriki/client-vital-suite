import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { DailyOptimizationData, DailyMetricItem } from "@/hooks/useDailyOptimization";

interface DailyOptimizationProps {
  data: DailyOptimizationData | null | undefined;
  isLoading: boolean;
}

function formatValue(value: number, format: DailyMetricItem["format"]): string {
  if (format === "aed") {
    return `AED ${Math.round(value).toLocaleString()}`;
  }
  if (format === "ratio") {
    return `${(value ?? 0).toFixed(2)}x`;
  }
  return Math.round(value).toLocaleString();
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 1) {
    return (
      <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/20 text-slate-400">
        <Minus className="w-2.5 h-2.5" />
        {Math.abs(delta).toFixed(0)}%
      </div>
    );
  }

  const isPositive = delta > 0;
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
        isPositive
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-red-500/20 text-red-400",
      )}
    >
      {isPositive ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : (
        <TrendingDown className="w-2.5 h-2.5" />
      )}
      {Math.abs(delta).toFixed(0)}%
    </div>
  );
}

function MetricCard({ metric }: { metric: DailyMetricItem }) {
  return (
    <Card className="border-white/10 bg-black/40 backdrop-blur-sm">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-wider text-[10px] text-slate-500 font-medium">
            {metric.label}
          </span>
          <DeltaBadge delta={metric.delta7d} />
        </div>

        <div className="text-xl font-bold text-slate-100 font-mono">
          {formatValue(metric.yesterday, metric.format)}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
          <div>
            <div className="text-[10px] text-slate-500">7d avg</div>
            <div className="text-xs text-slate-300 font-mono">
              {formatValue(metric.avg7d, metric.format)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">30d avg</div>
            <div className="text-xs text-slate-300 font-mono">
              {formatValue(metric.avg30d, metric.format)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DailyOptimization({ data, isLoading }: DailyOptimizationProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="border-white/10 bg-black/40 backdrop-blur-sm animate-pulse">
            <CardContent className="p-4 h-28" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-400">
        <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p>Daily metrics not yet populated. Runs automatically after daily sync.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Showing data for <span className="text-slate-300 font-medium">{data.date}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  );
}
