import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  ArrowDown,
  AlertTriangle,
  TrendingDown,
  Loader2,
} from "lucide-react";
import type { CohortProgressionData, FunnelStage } from "@/hooks/useCohortProgression";

interface CohortWaterfallProps {
  data: CohortProgressionData | null | undefined;
  isLoading: boolean;
}

function StageBar({
  stage,
  maxCount,
  isBottleneck,
}: {
  stage: FunnelStage;
  maxCount: number;
  isBottleneck: boolean;
}) {
  const widthPct = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 4) : 4;

  return (
    <div
      className={cn(
        "relative rounded-lg p-3 border transition-all",
        isBottleneck
          ? "border-red-500/60 bg-red-500/10 ring-1 ring-red-500/30"
          : "border-white/10 bg-white/5"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">
            {stage.name}
          </span>
          {isBottleneck && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 h-4 bg-red-500/20 text-red-400 border-red-500/40"
            >
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
              Bottleneck
            </Badge>
          )}
        </div>
        <span className="text-sm font-mono font-bold text-slate-100">
          {stage.count.toLocaleString()}
        </span>
      </div>

      {/* Bar visualization */}
      <div className="h-6 w-full bg-slate-800/60 rounded overflow-hidden">
        <div
          className={cn(
            "h-full rounded transition-all duration-700 ease-out",
            isBottleneck
              ? "bg-gradient-to-r from-red-500/70 to-red-400/50"
              : "bg-gradient-to-r from-blue-500/70 to-cyan-400/50"
          )}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function DropOffConnector({
  stage,
  isBottleneck,
}: {
  stage: FunnelStage;
  isBottleneck: boolean;
}) {
  if (stage.name === "Won") return null;

  return (
    <div className="flex items-center justify-between px-4 py-1.5">
      {/* Conversion arrow */}
      <div className="flex items-center gap-1.5">
        <ArrowRight
          className={cn(
            "w-3.5 h-3.5",
            isBottleneck ? "text-red-400" : "text-emerald-400"
          )}
        />
        <span
          className={cn(
            "text-xs font-mono font-semibold",
            stage.conversionToNext >= 50
              ? "text-emerald-400"
              : stage.conversionToNext >= 25
                ? "text-amber-400"
                : "text-red-400"
          )}
        >
          {stage.conversionToNext.toFixed(1)}% converted
        </span>
      </div>

      {/* Drop-off indicator */}
      <div className="flex items-center gap-1.5">
        <ArrowDown className="w-3.5 h-3.5 text-red-400/70" />
        <span className="text-xs font-mono text-red-400/80">
          {stage.dropOff.toFixed(1)}% lost
        </span>
      </div>
    </div>
  );
}

export function CohortWaterfall({ data, isLoading }: CohortWaterfallProps) {
  if (isLoading) {
    return (
      <Card className="border-white/10 bg-black/40 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-white/10 bg-black/40 backdrop-blur-sm">
        <CardContent className="text-center py-12 text-slate-400">
          <TrendingDown className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>
            Funnel data not yet available. Populates from daily analytics sync.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.stages.map((s) => s.count), 1);

  return (
    <Card className="border-white/10 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-100">
            Cohort Progression Waterfall
          </CardTitle>
          {data.date && (
            <span className="text-xs text-slate-500 font-mono">
              {data.date}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-0">
        {data.stages.map((stage, idx) => (
          <div key={stage.name}>
            <StageBar
              stage={stage}
              maxCount={maxCount}
              isBottleneck={stage.name === data.bottleneckStage}
            />
            {idx < data.stages.length - 1 && (
              <DropOffConnector
                stage={stage}
                isBottleneck={stage.name === data.bottleneckStage}
              />
            )}
          </div>
        ))}

        {/* Overall conversion summary */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                data.overallConversion >= 3
                  ? "bg-emerald-400"
                  : data.overallConversion >= 1
                    ? "bg-amber-400"
                    : "bg-red-400"
              )}
            />
            <span className="text-sm text-slate-300">
              Overall lead-to-customer
            </span>
          </div>
          <span
            className={cn(
              "text-lg font-mono font-bold",
              data.overallConversion >= 3
                ? "text-emerald-400"
                : data.overallConversion >= 1
                  ? "text-amber-400"
                  : "text-red-400"
            )}
          >
            {data.overallConversion.toFixed(1)}%
          </span>
        </div>

        {/* Bottleneck callout */}
        {data.bottleneckStage && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs text-red-300">
              <span className="font-bold">Biggest drop-off:</span>{" "}
              {data.bottleneckStage} stage has the lowest conversion rate at{" "}
              {data.stages
                .find((s) => s.name === data.bottleneckStage)
                ?.conversionToNext.toFixed(1)}
              %. Focus optimization efforts here for maximum funnel impact.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
