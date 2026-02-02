import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, RefreshCw, AlertCircle } from "lucide-react";
import { BIAnalysis } from "@/types/ceo";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";

interface CEOBusinessIntelligenceProps {
  biData:
    | {
        success: boolean;
        analysis: BIAnalysis;
        dataFreshness: string;
        staleWarning: string | null;
      }
    | undefined;
  loadingBI: boolean;
  refetchBI: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<any, Error>>;
}

export function CEOBusinessIntelligence({
  biData,
  loadingBI,
  refetchBI,
}: CEOBusinessIntelligenceProps) {
  if (!biData?.analysis) return null;

  return (
    <Card className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-indigo-500/10 border-cyan-500/30">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-bold text-white">
                Executive Briefing
              </h2>
              <Badge
                variant={
                  biData.dataFreshness === "FRESH" ? "default" : "destructive"
                }
                className="text-xs"
              >
                {biData.dataFreshness === "FRESH" ? "Live Data" : "Stale Data"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchBI()}
                className="ml-auto text-cyan-400 hover:text-cyan-300"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingBI ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            <p className="text-white/80 text-sm leading-relaxed">
              {biData.analysis.executive_summary ||
                "Analyzing business vitals..."}
            </p>
            {biData.staleWarning && (
              <p className="text-yellow-400 text-xs mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {biData.staleWarning}
              </p>
            )}
            {biData.analysis.action_plan &&
              biData.analysis.action_plan.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {biData.analysis.action_plan.slice(0, 3).map((action, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-cyan-400 border-cyan-400/30"
                    >
                      {action}
                    </Badge>
                  ))}
                </div>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
