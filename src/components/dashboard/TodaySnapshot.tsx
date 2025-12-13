import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Calendar, UserPlus, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";

interface SnapshotStat {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

export function TodaySnapshot() {
  const today = new Date();
  const startOfToday = startOfDay(today).toISOString();
  const endOfToday = endOfDay(today).toISOString();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['today-snapshot'],
    queryFn: async () => {
      // Fetch all stats in parallel
      const [callsResult, appointmentsResult, leadsResult, dealsResult] = await Promise.all([
        supabase
          .from('call_records')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfToday)
          .lte('created_at', endOfToday),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .gte('scheduled_at', startOfToday)
          .lte('scheduled_at', endOfToday),
        supabase
          .from('enhanced_leads')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfToday)
          .lte('created_at', endOfToday),
        (supabase as any)
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .gte('close_date', startOfToday.split('T')[0])
          .lte('close_date', endOfToday.split('T')[0])
          .eq('status', 'won'),
      ]);

      return {
        calls: callsResult.count || 0,
        appointments: appointmentsResult.count || 0,
        leads: leadsResult.count || 0,
        deals: dealsResult.count || 0,
      };
    },
    refetchInterval: 60000,
  });

  const snapshotStats: SnapshotStat[] = [
    { label: "Calls Made", value: stats?.calls || 0, icon: Phone, color: "text-primary" },
    { label: "Appointments", value: stats?.appointments || 0, icon: Calendar, color: "text-success" },
    { label: "New Leads", value: stats?.leads || 0, icon: UserPlus, color: "text-warning" },
    { label: "Deals Closed", value: stats?.deals || 0, icon: DollarSign, color: "text-success" },
  ];

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '350ms' }}>
      <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
        Today's Activity
      </h3>
      
      <div className="space-y-4">
        {snapshotStats.map((stat, i) => (
          <div 
            key={stat.label}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted/50", stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            
            {isLoading ? (
              <div className="skeleton h-6 w-8" />
            ) : (
              <span className="stat-number text-xl font-semibold">
                {stat.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
