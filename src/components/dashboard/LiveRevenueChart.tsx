import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useMemo } from "react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";

export function LiveRevenueChart() {
  const { data: deals, isLoading } = useDedupedQuery({
    queryKey: QUERY_KEYS.revenue.chart,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data, error } = await (supabase as any)
        .from('deals')
        .select('deal_value, close_date')
        .eq('status', 'closed')
        .gte('close_date', thirtyDaysAgo)
        .order('close_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const chartData = useMemo(() => {
    const now = new Date();
    const days = eachDayOfInterval({
      start: subDays(now, 29),
      end: now,
    });

    // Group deals by date
    const dealsByDate: Record<string, number> = {};
    deals?.forEach((deal: any) => {
      const date = deal.close_date;
      if (date) {
        dealsByDate[date] = (dealsByDate[date] || 0) + (deal.deal_value || 0);
      }
    });

    // Create chart data with all days
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'MMM d'),
        value: dealsByDate[dateStr] || 0,
        fullDate: dateStr,
      };
    });
  }, [deals]);

  const stats = useMemo(() => {
    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    
    // Compare first half to second half for trend
    const halfIndex = Math.floor(chartData.length / 2);
    const firstHalfTotal = chartData.slice(0, halfIndex).reduce((s, d) => s + d.value, 0);
    const secondHalfTotal = chartData.slice(halfIndex).reduce((s, d) => s + d.value, 0);
    
    const trend = firstHalfTotal > 0 
      ? Math.round(((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100)
      : 0;
    
    return {
      total,
      trend: Math.abs(trend),
      isPositive: trend >= 0,
    };
  }, [chartData]);

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  };

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '250ms' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Revenue Trend
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
        </div>
        <div className="text-right">
          {isLoading ? (
            <>
              <div className="skeleton h-8 w-28 mb-1" />
              <div className="skeleton h-4 w-16 ml-auto" />
            </>
          ) : stats.total === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">No revenue yet</p>
              <p className="text-xs text-muted-foreground">Close deals to see data</p>
            </div>
          ) : (
            <>
              <p className="stat-number text-2xl">AED {formatValue(stats.total)}</p>
              <div className="flex items-center gap-1 justify-end">
                {stats.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  stats.isPositive ? "text-success" : "text-destructive"
                )}>
                  {stats.isPositive ? "+" : "-"}{stats.trend}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-full h-full bg-muted/20 rounded-lg shimmer" />
        </div>
      ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(263, 70%, 50%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(263, 70%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(240, 5%, 46%)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fill: 'hsl(240, 5%, 46%)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatValue}
                width={45}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(240, 10%, 7%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
                labelStyle={{ color: 'hsl(0, 0%, 98%)' }}
                formatter={(value: number) => [`AED ${value.toLocaleString()}`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(263, 70%, 50%)"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
