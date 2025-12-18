import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Calendar, UserPlus, DollarSign, ChevronRight, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface SnapshotStat {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  href: string;
  tooltip: string;
}

export function TodaySnapshot() {
  const navigate = useNavigate();
  const today = new Date();
  const startOfToday = startOfDay(today).toISOString();
  const endOfToday = endOfDay(today).toISOString();

  const { data: stats, isLoading } = useDedupedQuery({
    queryKey: QUERY_KEYS.summaries.todaySnapshot,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
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
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const snapshotStats: SnapshotStat[] = [
    { label: "Calls Made", value: stats?.calls || 0, icon: Phone, color: "text-primary", bgColor: "bg-primary/10", href: "/call-tracking?date=today", tooltip: "View today's call activity" },
    { label: "Appointments", value: stats?.appointments || 0, icon: Calendar, color: "text-success", bgColor: "bg-success/10", href: "/hubspot-live?tab=meetings", tooltip: "View scheduled appointments" },
    { label: "New Leads", value: stats?.leads || 0, icon: UserPlus, color: "text-warning", bgColor: "bg-warning/10", href: "/hubspot-live?tab=leads&filter=today", tooltip: "View new leads from today" },
    { label: "Deals Closed", value: stats?.deals || 0, icon: DollarSign, color: "text-success", bgColor: "bg-success/10", href: "/sales-pipeline?filter=closed", tooltip: "View closed deals" },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/20 p-6 animate-fade-up shadow-sm hover:shadow-md transition-shadow duration-300" style={{ animationDelay: '350ms' }}>
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-2xl" />
      
      <div className="relative flex items-center justify-between mb-5">
        <button 
          onClick={() => navigate('/analytics')}
          className="text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group"
        >
          <Activity className="h-4 w-4 text-primary" />
          Today's Activity
          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Live</span>
        </div>
      </div>
      
      <div className="relative space-y-1">
        {snapshotStats.map((stat, index) => (
          <TooltipProvider key={stat.label}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => navigate(stat.href)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-gradient-to-r hover:from-muted/40 hover:to-muted/20 transition-all duration-300 group border border-transparent hover:border-border/50"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 ring-1",
                      stat.bgColor,
                      stat.color.replace('text-', 'ring-') + '/20'
                    )}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {stat.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <div className="skeleton h-7 w-10 rounded" />
                    ) : (
                      <span className={cn(
                        "stat-number text-xl font-bold transition-all duration-300",
                        stat.value > 0 ? stat.color : "text-muted-foreground",
                        "group-hover:scale-110"
                      )}>
                        {stat.value}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 -translate-x-1 transition-all duration-200" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-card border-border">
                {stat.tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}
