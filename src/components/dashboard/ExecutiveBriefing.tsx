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
    <Card className="mb-6 border-l-4 border-l-purple-500 bg-muted/30">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <BrainCircuit className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Daily Executive Briefing</h3>
              <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString()}</span>
            </div>
            <p className="text-muted-foreground">
              {summary?.executive_briefing || "Analyzing business vitals..."}
            </p>
            
            {/* Actionable Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-card p-3 rounded border shadow-sm">
                <span className="text-xs text-muted-foreground uppercase">Utilization</span>
                <div className={`text-2xl font-bold ${isUnderCapacity ? 'text-amber-500' : 'text-green-500'}`}>
                  {utilizationRate}%
                </div>
                {isUnderCapacity && (
                  <div className="text-xs text-amber-500 flex items-center gap-1">
                    📉 Under Capacity - Run Promo
                  </div>
                )}
              </div>
              
              <div className="bg-card p-3 rounded border shadow-sm">
                <span className="text-xs text-muted-foreground uppercase">Critical Errors</span>
                <div className="flex items-center gap-2">
                  {hasErrors ? (
                    <AlertTriangle className="text-destructive h-5 w-5" />
                  ) : (
                    <CheckCircle className="text-green-500 h-5 w-5" />
                  )}
                  <span className="font-bold">{hasErrors ? "Action Required" : "Stable"}</span>
                </div>
                <div className="text-xs text-muted-foreground">{summary?.system_health_status || 'Checking...'}</div>
              </div>

              <div className="bg-card p-3 rounded border shadow-sm">
                <span className="text-xs text-muted-foreground uppercase">SLA Breaches</span>
                <div className="flex items-center gap-2">
                  <Clock className={`h-5 w-5 ${(summary?.sla_breach_count || 0) > 0 ? 'text-destructive' : 'text-green-500'}`} />
                  <span className={`text-2xl font-bold ${(summary?.sla_breach_count || 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {summary?.sla_breach_count || 0}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Leads waiting &gt; 30m</div>
              </div>
            </div>

            {/* Action Plan */}
            {summary?.action_plan && summary.action_plan.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                <span className="text-xs text-amber-600 dark:text-amber-400 uppercase font-semibold">Priority Actions</span>
                <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
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
