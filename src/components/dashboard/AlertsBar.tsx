import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { subMinutes, subHours } from "date-fns";
import { QUERY_KEYS } from "@/config/queryKeys";

interface Alert {
  id: string;
  type: "sla" | "stale" | "sync" | "critical";
  message: string;
  count: number;
  href: string;
}

export function AlertsBar() {
  const navigate = useNavigate();
  const now = new Date();

  const { data: alerts } = useQuery({
    queryKey: QUERY_KEYS.dashboard.alerts,
    queryFn: async () => {
      const alertsList: Alert[] = [];

      // Check SLA breaches (leads waiting > 30 min with no contact)
      const slaThreshold = subMinutes(now, 30).toISOString();
      const { count: slaCount } = await supabase
        .from('enhanced_leads')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', slaThreshold)
        .eq('conversion_status', 'new');

      if (slaCount && slaCount > 0) {
        alertsList.push({
          id: 'sla',
          type: 'sla',
          message: `${slaCount} leads waiting over 30 minutes`,
          count: slaCount,
          href: '/hubspot-live?filter=sla-breach',
        });
      }

      // Check sync errors
      const { count: syncCount } = await (supabase as any)
        .from('sync_errors')
        .select('id', { count: 'exact', head: true })
        .is('resolved_at', null);

      if (syncCount && syncCount > 0) {
        alertsList.push({
          id: 'sync',
          type: 'sync',
          message: `${syncCount} sync errors need attention`,
          count: syncCount,
          href: '/ptd-control?tab=errors',
        });
      }

      // Check critical clients
      const { count: criticalCount } = await supabase
        .from('client_health_scores')
        .select('id', { count: 'exact', head: true })
        .eq('health_zone', 'RED');

      if (criticalCount && criticalCount > 3) {
        alertsList.push({
          id: 'critical',
          type: 'critical',
          message: `${criticalCount} clients in critical zone`,
          count: criticalCount,
          href: '/clients?zone=RED',
        });
      }

      return alertsList;
    },
    refetchInterval: 60000,
  });

  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-success/5 border border-success/20 text-success text-sm animate-fade-up" style={{ animationDelay: '500ms' }}>
        <CheckCircle className="h-4 w-4" />
        <span>All clear — no issues detected</span>
      </div>
    );
  }

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'sla':
        return { icon: Clock, bg: "bg-warning/10 border-warning/30", text: "text-warning" };
      case 'sync':
        return { icon: XCircle, bg: "bg-destructive/10 border-destructive/30", text: "text-destructive" };
      case 'critical':
        return { icon: AlertTriangle, bg: "bg-destructive/10 border-destructive/30", text: "text-destructive" };
      default:
        return { icon: AlertTriangle, bg: "bg-warning/10 border-warning/30", text: "text-warning" };
    }
  };

  return (
    <div className="space-y-2 animate-fade-up" style={{ animationDelay: '500ms' }}>
      {alerts.map(alert => {
        const styles = getAlertStyles(alert.type);
        const Icon = styles.icon;
        
        return (
          <button
            key={alert.id}
            onClick={() => navigate(alert.href)}
            className={cn(
              "w-full flex items-center gap-3 py-3 px-4 rounded-xl border transition-all hover:scale-[1.01]",
              styles.bg
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", styles.text)} />
            <span className={cn("text-sm font-medium", styles.text)}>
              {alert.message}
            </span>
          </button>
        );
      })}
    </div>
  );
}
