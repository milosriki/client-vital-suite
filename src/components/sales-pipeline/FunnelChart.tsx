import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, ArrowRight } from "lucide-react";
import { STATUS_CONFIG } from "./constants";

interface FunnelChartProps {
  funnelData: any;
}

export const FunnelChart = ({ funnelData }: FunnelChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Lead Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
          {Object.entries(STATUS_CONFIG).map(([status, config], index) => {
            const count = funnelData?.statusCounts?.[status] || 0;
            const percentage = funnelData?.total
              ? (count / funnelData.total) * 100
              : 0;
            const Icon = config.icon;

            return (
              <div key={status} className="flex items-center">
                <div className="flex flex-col items-center min-w-[120px]">
                  <div
                    className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center text-white mb-2`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground text-center">
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                {index < Object.keys(STATUS_CONFIG).length - 1 && (
                  <ArrowRight className="h-6 w-6 text-muted-foreground mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
