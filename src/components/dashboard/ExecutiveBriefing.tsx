import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, BrainCircuit, Clock } from "lucide-react";

interface ExecutiveBriefingProps {
  summary: {
    executive_briefing?: string;
    max_utilization_rate?: number;
    system_health_status?: string;
    action_plan?: string[];
    sla_breach_count?: number;
  } | null;
}

export function ExecutiveBriefing({ summary }: ExecutiveBriefingProps) {
  const hasErrors = summary?.system_health_status !== 'Healthy' && 
                    summary?.system_health_status?.includes?.('Error');
  const utilizationRate = summary?.max_utilization_rate || 0;
  const isUnderCapacity = utilizationRate < 80;
  
  return (
    <Card className="border-l-4 border-l-purple-500 bg-muted/30">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg shrink-0">
            <BrainCircuit className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-bold text-lg">Daily Executive Briefing</h3>
              <span className="text-sm text-muted-foreground shrink-0">{new Date().toLocaleDateString()}</span>
            </div>
            
            <p className="text-muted-foreground text-sm">
              {summary?.executive_briefing || "Analyzing business vitals..."}
            </p>
            
            {/* Actionable Metrics - Equal height cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-card p-3 rounded-lg border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Utilization</span>
                <div className={`text-lg sm:text-xl font-bold mt-1 ${isUnderCapacity ? 'text-amber-500' : 'text-green-500'}`}>
                  {utilizationRate}%
                </div>
                {isUnderCapacity && (
                  <div className="text-[10px] text-amber-500 mt-0.5">📉 Under Capacity - Run Promo</div>
                )}
              </div>
              
              <div className="bg-card p-3 rounded-lg border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Critical Errors</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {hasErrors ? (
                    <AlertTriangle className="text-destructive h-4 w-4" />
                  ) : (
                    <CheckCircle className="text-green-500 h-4 w-4" />
                  )}
                  <span className="font-bold text-xs sm:text-sm">{hasErrors ? "Action Required" : "Stable"}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{summary?.system_health_status || 'Checking...'}</div>
              </div>

              <div className="bg-card p-3 rounded-lg border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">SLA Breaches</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className={`h-4 w-4 ${(summary?.sla_breach_count || 0) > 0 ? 'text-destructive' : 'text-green-500'}`} />
                  <span className={`text-lg sm:text-xl font-bold ${(summary?.sla_breach_count || 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {summary?.sla_breach_count || 0}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Leads waiting &gt; 30m</div>
              </div>
            </div>

            {/* Action Plan */}
            {summary?.action_plan && summary.action_plan.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold tracking-wide">Priority Actions</span>
                <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-300 mt-1.5 space-y-0.5">
                  {summary.action_plan.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
