import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend,
  AreaChart,
  Area
} from "recharts";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, eachDayOfInterval } from "date-fns";

export function RevenueVsSpendChart() {
  const { data: metrics, isLoading } = useDedupedQuery({
    queryKey: ["daily-business-metrics-chart"],
    queryFn: async () => {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('daily_business_metrics')
        .select('date, total_revenue_booked, ad_spend_facebook')
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  const chartData = useMemo(() => {
    const now = new Date();
    const days = eachDayOfInterval({
      start: subDays(now, 14), // Last 14 days for clearer view
      end: now,
    });

    const metricsByDate: Record<string, any> = {};
    metrics?.forEach((m: any) => {
      metricsByDate[m.date] = m;
    });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayMetrics = metricsByDate[dateStr];
      return {
        date: format(day, 'MMM d'),
        revenue: parseFloat(dayMetrics?.total_revenue_booked || 0),
        spend: parseFloat(dayMetrics?.ad_spend_facebook || 0),
        fullDate: dateStr,
      };
    });
  }, [metrics]);

  const totals = useMemo(() => {
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalSpend = chartData.reduce((sum, d) => sum + d.spend, 0);
    const roas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(1) : "0.0";
    
    return {
      revenue: totalRevenue,
      spend: totalSpend,
      roas
    };
  }, [chartData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Marketing Efficiency
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Revenue vs. Ad Spend (Last 14 Days)</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Total ROAS</p>
            <p className="text-xl font-bold text-primary">{totals.roas}x</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Net Profit</p>
            <p className="text-xl font-bold text-success">
              AED {formatCurrency(totals.revenue - totals.spend)}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[250px] flex items-center justify-center">
          <div className="w-full h-full bg-muted/20 rounded-lg shimmer" />
        </div>
      ) : (
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Area
                name="Revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                name="Ad Spend"
                type="monotone"
                dataKey="spend"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSpend)"
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
