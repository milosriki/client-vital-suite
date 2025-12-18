import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Skull, Clock, RotateCcw } from "lucide-react";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface LeakMetrics {
  stuck_in_loop_count: number;
  buried_count: number;
  sla_breach_count: number;
  no_activity_48h: number;
}

export function LeakDetector() {
  const { data: leaks } = useDedupedQuery<LeakMetrics>({
    queryKey: QUERY_KEYS.leaks.detector,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const now = new Date();
      const hours3Ago = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const hours48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const mins30Ago = new Date(now.getTime() - 30 * 60 * 1000);

      // Leads stuck in loop (reassigned multiple times)
      const { data: loopLeads } = await supabase
        .from('contacts')
        .select('id')
        .gt('count_of_reassignations', 2);

      // Buried leads (assigned > 3h, no call)
      const { data: buriedLeads } = await supabase
        .from('contacts')
        .select('id')
        .lt('created_at', hours3Ago.toISOString())
        .is('first_outbound_call_time', null)
        .eq('contact_unworked', true);

      // SLA breaches (waiting > 30 mins)
      const { data: slaBreaches } = await supabase
        .from('contacts')
        .select('id')
        .lt('created_at', mins30Ago.toISOString())
        .is('first_outbound_call_time', null)
        .eq('contact_unworked', true);

      // No activity in 48h
      const { data: staleLeads } = await supabase
        .from('contacts')
        .select('id')
        .lt('last_activity_date', hours48Ago.toISOString());

      return {
        stuck_in_loop_count: loopLeads?.length || 0,
        buried_count: buriedLeads?.length || 0,
        sla_breach_count: slaBreaches?.length || 0,
        no_activity_48h: staleLeads?.length || 0,
      };
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const metrics = [
    {
      label: "Infinite Loop",
      icon: RotateCcw,
      value: leaks?.stuck_in_loop_count || 0,
      description: "Leads re-assigning forever",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/30",
      textColor: "text-destructive",
    },
    {
      label: "Buried Leads",
      icon: Skull,
      value: leaks?.buried_count || 0,
      description: "Assigned > 3h (No Call)",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      textColor: "text-orange-500",
    },
    {
      label: "SLA Breaches",
      icon: AlertTriangle,
      value: leaks?.sla_breach_count || 0,
      description: "Waiting > 30 mins",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-500",
    },
    {
      label: "Stale Leads",
      icon: Clock,
      value: leaks?.no_activity_48h || 0,
      description: "No activity in 48h",
      bgColor: "bg-slate-500/10",
      borderColor: "border-slate-500/30",
      textColor: "text-slate-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.label} className={`${metric.bgColor} ${metric.borderColor} border hover:shadow-md transition-shadow`}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Icon className={`h-4 w-4 ${metric.textColor}`} />
                <span className="text-2xl font-bold">{metric.value}</span>
              </div>
              <div className="space-y-0.5">
                <p className={`font-medium text-sm ${metric.textColor}`}>{metric.label}</p>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
