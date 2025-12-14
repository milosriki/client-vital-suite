import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, BrainCircuit, Clock, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const slaBreaches = summary?.sla_breach_count || 0;
  
  return (
    <Card className="relative overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card rounded-2xl animate-fade-up shadow-sm hover:shadow-lg transition-shadow duration-300" style={{ animationDelay: '50ms' }}>
      {/* Gradient Border Effect */}
      <div className="absolute inset-[0] rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent opacity-50" />
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-radial from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-success/8 to-transparent rounded-full blur-2xl" />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-gradient-to-bl from-warning/5 to-transparent rounded-full blur-xl" />
      
      <CardContent className="relative p-6">
        <div className="flex items-start gap-5">
          {/* Icon with Glow */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/30 rounded-xl blur-xl" />
            <div className="relative p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/20">
              <BrainCircuit className="h-6 w-6 text-primary" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-xl tracking-tight">Daily Executive Briefing</h3>
                <span className="badge-premium flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  AI Summary
                </span>
              </div>
              <span className="text-sm text-muted-foreground font-mono">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            
            <p className="text-muted-foreground text-sm leading-relaxed">
              {summary?.executive_briefing || "Analyzing business vitals and generating insights..."}
            </p>
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Utilization */}
              <div className={cn(
                "relative overflow-hidden p-4 rounded-xl border transition-all duration-300 hover:-translate-y-0.5",
                isUnderCapacity 
                  ? "bg-warning/5 border-warning/20 hover:border-warning/40" 
                  : "bg-success/5 border-success/20 hover:border-success/40"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    Utilization
                  </span>
                  <TrendingUp className={cn(
                    "h-3.5 w-3.5",
                    isUnderCapacity ? "text-warning" : "text-success"
                  )} />
                </div>
                <div className={cn(
                  "stat-number text-2xl",
                  isUnderCapacity ? "text-warning" : "text-success"
                )}>
                  {utilizationRate}%
                </div>
                {/* Progress Bar */}
                <div className="mt-2 h-1 rounded-full bg-muted/30 overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isUnderCapacity ? "bg-warning" : "bg-success"
                    )}
                    style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                  />
                </div>
                {isUnderCapacity && (
                  <p className="text-[10px] text-warning mt-2 flex items-center gap-1">
                    <span>📉</span> Consider running a promotion
                  </p>
                )}
              </div>
              
              {/* System Status */}
              <div className={cn(
                "relative overflow-hidden p-4 rounded-xl border transition-all duration-300 hover:-translate-y-0.5",
                hasErrors 
                  ? "bg-destructive/5 border-destructive/20 hover:border-destructive/40" 
                  : "bg-success/5 border-success/20 hover:border-success/40"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    System Health
                  </span>
                  {hasErrors ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "font-semibold text-sm",
                    hasErrors ? "text-destructive" : "text-success"
                  )}>
                    {hasErrors ? "Action Required" : "All Systems Stable"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {summary?.system_health_status || 'Monitoring...'}
                </p>
              </div>

              {/* SLA Breaches */}
              <div className={cn(
                "relative overflow-hidden p-4 rounded-xl border transition-all duration-300 hover:-translate-y-0.5",
                slaBreaches > 0 
                  ? "bg-destructive/5 border-destructive/20 hover:border-destructive/40" 
                  : "bg-success/5 border-success/20 hover:border-success/40"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    SLA Breaches
                  </span>
                  <Clock className={cn(
                    "h-3.5 w-3.5",
                    slaBreaches > 0 ? "text-destructive" : "text-success"
                  )} />
                </div>
                <div className={cn(
                  "stat-number text-2xl",
                  slaBreaches > 0 ? "text-destructive" : "text-foreground"
                )}>
                  {slaBreaches}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Leads waiting &gt; 30 minutes
                </p>
              </div>
            </div>

            {/* Action Plan */}
            {summary?.action_plan && summary.action_plan.length > 0 && (
              <div className="relative overflow-hidden p-4 bg-gradient-to-r from-warning/10 to-warning/5 rounded-xl border border-warning/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                  <span className="text-xs text-warning uppercase font-semibold tracking-wider">
                    Priority Actions
                  </span>
                </div>
                <ul className="space-y-2">
                  {summary.action_plan.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <span className="text-warning mt-0.5">→</span>
                      {action}
                    </li>
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