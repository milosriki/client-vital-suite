import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Calendar, UserPlus, DollarSign, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";

interface SnapshotStat {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href: string;
  tooltip: string;
}

export function TodaySnapshot() {
  const navigate = useNavigate();
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
          .eq('status', 'closed'),
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
    { label: "Calls Made", value: stats?.calls || 0, icon: Phone, color: "text-primary", href: "/call-tracking?date=today", tooltip: "View today's call activity" },
    { label: "Appointments", value: stats?.appointments || 0, icon: Calendar, color: "text-success", href: "/hubspot-live?tab=meetings", tooltip: "View scheduled appointments" },
    { label: "New Leads", value: stats?.leads || 0, icon: UserPlus, color: "text-warning", href: "/hubspot-live?tab=leads&filter=today", tooltip: "View new leads from today" },
    { label: "Deals Closed", value: stats?.deals || 0, icon: DollarSign, color: "text-success", href: "/sales-pipeline?filter=closed", tooltip: "View closed deals" },
  ];

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '350ms' }}>
      <h3 
        onClick={() => navigate('/analytics')}
        className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4 cursor-pointer hover:text-primary hover:underline transition-colors"
      >
        Today's Activity
      </h3>
      
      <div className="space-y-2">
        {snapshotStats.map((stat) => (
          <TooltipProvider key={stat.label}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => navigate(stat.href)}
                  className="w-full flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg bg-muted/50 transition-colors group-hover:bg-primary/10", stat.color)}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{stat.label}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <div className="skeleton h-6 w-8" />
                    ) : (
                      <span className="stat-number text-xl font-semibold">
                        {stat.value}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{stat.tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}
