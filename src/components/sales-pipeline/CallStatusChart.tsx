import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneCall } from "lucide-react";
import { CALL_STATUS_CONFIG } from "./constants";

interface CallStatusChartProps {
  callRecords: any;
}

export const CallStatusChart = ({ callRecords }: CallStatusChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5" />
          Call Status Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {Object.entries(CALL_STATUS_CONFIG).map(([status, config]) => {
            const count = callRecords?.statusCounts?.[status] || 0;
            const Icon = config.icon;
            return (
              <div
                key={status}
                className="flex flex-col items-center p-3 rounded-lg bg-muted/50"
              >
                <div
                  className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white mb-2`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold">{count}</span>
                <span className="text-xs text-muted-foreground">
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
