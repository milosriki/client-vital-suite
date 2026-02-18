import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, ArrowRight } from "lucide-react";
import { STATUS_CONFIG } from "./constants";
import { DEAL_STAGES, HUBSPOT_STAGE_IDS } from "@/constants/dealStages";

/** The pipeline stages to show in order */
const FUNNEL_STAGES = [
  DEAL_STAGES.DECISION_MAKER_BOUGHT_IN,
  DEAL_STAGES.QUALIFIED_TO_BUY,
  HUBSPOT_STAGE_IDS.ASSESSMENT_BOOKING,
  HUBSPOT_STAGE_IDS.BOOKED,
  HUBSPOT_STAGE_IDS.ASSESSMENT_POSTPONED,
  HUBSPOT_STAGE_IDS.ASSESSMENT_DONE,
  DEAL_STAGES.CONTRACT_SENT,
  DEAL_STAGES.CLOSED_WON,
  DEAL_STAGES.CLOSED_LOST,
];

interface FunnelChartProps {
  funnelData?: any;
  deals?: any[];
}

export const FunnelChart = ({ funnelData, deals }: FunnelChartProps) => {
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (deals?.length) {
      deals.forEach((d) => {
        const stage = d.stage;
        if (stage) counts[stage] = (counts[stage] || 0) + 1;
      });
    }
    return counts;
  }, [deals]);

  const total = deals?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Deal Pipeline Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
          {FUNNEL_STAGES.map((stage, index) => {
            const config = STATUS_CONFIG[stage];
            if (!config) return null;
            const count = stageCounts[stage] || 0;
            const percentage = total ? (count / total) * 100 : 0;
            const Icon = config.icon;

            return (
              <div key={stage} className="flex items-center">
                <div className="flex flex-col items-center min-w-[110px] group cursor-default">
                  <div
                    className={`w-14 h-14 rounded-full ${config.color} flex items-center justify-center text-white mb-2 transition-transform duration-200 group-hover:scale-110`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground text-center leading-tight">
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                {index < FUNNEL_STAGES.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground mx-1 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
