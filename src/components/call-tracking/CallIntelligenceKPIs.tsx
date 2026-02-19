import { Card, CardContent } from "@/components/ui/card";
import { Phone, PhoneIncoming, Clock, PhoneMissed, Timer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KPIData {
  totalCalls: number;
  answeredRate: number;
  avgDuration: number;
  missedCalls: number;
  avgWaitTime: number;
}

interface Props {
  data: KPIData;
  isLoading: boolean;
}

export function CallIntelligenceKPIs({ data, isLoading }: Props) {
  const kpis = [
    { label: "Total Calls", value: data.totalCalls.toLocaleString(), icon: Phone, color: "text-primary", bg: "bg-primary/10" },
    { label: "Answered Rate", value: `${data.answeredRate.toFixed(1)}%`, icon: PhoneIncoming, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Avg Duration", value: `${Math.floor(data.avgDuration / 60)}:${String(Math.round(data.avgDuration % 60)).padStart(2, '0')}`, icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Missed Calls", value: data.missedCalls.toLocaleString(), icon: PhoneMissed, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Avg Wait Time", value: data.avgWaitTime > 0 ? `${data.avgWaitTime.toFixed(0)}s` : "N/A", icon: Timer, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className={isLoading ? "animate-pulse" : ""}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "—" : kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
