import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import { ProactiveInsight } from "@/types/ceo";
import { UseMutationResult } from "@tanstack/react-query";

interface CEOInsightsProps {
  insights: ProactiveInsight[] | undefined;
  generateSolution: UseMutationResult<void, Error, string, unknown>;
}

export function CEOInsights({ insights, generateSolution }: CEOInsightsProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {insights?.map((insight) => (
        <Card key={insight.id} className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Lightbulb className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white">{insight.title}</h3>
                  <Badge
                    variant="outline"
                    className="text-cyan-400 border-cyan-400/50"
                  >
                    {insight.insight_type}
                  </Badge>
                </div>
                <p className="text-sm text-white/70">{insight.description}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={() =>
                      generateSolution.mutate(
                        `Act on this insight: ${insight.title}`,
                      )
                    }
                  >
                    Generate Action Plan
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {(!insights || insights.length === 0) && (
        <div className="text-center py-12 text-white/40">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No proactive insights yet. Click "Run Monitor" to generate.</p>
        </div>
      )}
    </div>
  );
}
