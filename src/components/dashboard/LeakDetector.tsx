import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Skull, Clock, RotateCcw } from "lucide-react";

interface LeakMetrics {
  stuck_in_loop_count: number;
  buried_count: number;
  sla_breach_count: number;
  no_activity_48h: number;
}

export function LeakDetector() {
  const { data: leaks } = useQuery<LeakMetrics>({
    queryKey: ['leak-detector'],
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
    refetchInterval: 60000,
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.label} className={`${metric.bgColor} ${metric.borderColor} border`}>
            <div className="p-4">
              <div className={`${metric.textColor} font-bold flex items-center gap-2`}>
                <Icon className="h-4 w-4" />
                {metric.label}
              </div>
              <div className="text-3xl font-black">{metric.value}</div>
              <div className={`text-xs ${metric.textColor} opacity-70`}>{metric.description}</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
