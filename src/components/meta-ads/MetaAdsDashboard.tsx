import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { fetchCampaigns, analyzeBudget } from "@/lib/metaAdsApi";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

function MetricCard({ title, value, trend, trendUp, icon: Icon, color }: {
  title: string; value: string; trend: string; trendUp: boolean;
  icon: typeof DollarSign; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className={`flex items-center gap-1 mt-1 text-xs ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
        {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {trend}
      </div>
    </div>
  );
}

export default function MetaAdsDashboard() {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Fetch real data from Supabase facebook_ads_insights
  const { data: adsData, isLoading: adsLoading } = useDedupedQuery({
    queryKey: ["meta-ads-insights-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_ads_insights")
        .select("*")
        .order("date_start", { ascending: false })
        .limit(90);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate KPIs from real data
  const kpis = useMemo(() => {
    if (!adsData || adsData.length === 0) {
      return { totalSpend: 0, avgRoas: 0, totalImpressions: 0, totalConversions: 0 };
    }
    const totalSpend = adsData.reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0);
    const totalImpressions = adsData.reduce((s: number, r: any) => s + (Number(r.impressions) || 0), 0);
    const totalConversions = adsData.reduce((s: number, r: any) => s + (Number(r.conversions) || 0), 0);
    const roasValues = adsData.filter((r: any) => r.roas != null).map((r: any) => Number(r.roas) || 0);
    const avgRoas = roasValues.length > 0 ? roasValues.reduce((a: number, b: number) => a + b, 0) / roasValues.length : 0;
    return { totalSpend, avgRoas, totalImpressions, totalConversions };
  }, [adsData]);

  // Build daily chart data from real data
  const dailyData = useMemo(() => {
    if (!adsData || adsData.length === 0) return [];
    // Aggregate by date
    const byDate = new Map<string, { spend: number; conversions: number }>();
    for (const row of adsData) {
      const date = row.date_start;
      if (!date) continue;
      const existing = byDate.get(date) || { spend: 0, conversions: 0 };
      existing.spend += Number(row.spend) || 0;
      existing.conversions += Number(row.conversions) || 0;
      byDate.set(date, existing);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date: format(new Date(date), "MMM d"),
        spend: Math.round(d.spend),
        conversions: Math.round(d.conversions),
      }));
  }, [adsData]);

  const handleFetchCampaigns = async () => {
    setLoading("campaigns");
    try {
      const result = await fetchCampaigns("last_30d");
      setAiInsight(result);
    } catch (e) {
      setAiInsight(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleAnalyzeBudget = async () => {
    setLoading("budget");
    try {
      const result = await analyzeBudget();
      setAiInsight(result);
    } catch (e) {
      setAiInsight(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  };

  if (adsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const hasData = adsData && adsData.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Meta Ads Performance</h2>
          <p className="text-slate-500 text-sm">
            PTD Fitness — Real data from {adsData?.length || 0} insights
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFetchCampaigns}
            disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >
            {loading === "campaigns" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Fetch Campaigns
          </button>
          <button
            onClick={handleAnalyzeBudget}
            disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            {loading === "budget" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            Optimize Budget
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Spend"
          value={`AED ${kpis.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          trend={hasData ? "From real data" : "No data"}
          trendUp={hasData}
          icon={DollarSign}
          color="bg-blue-100 text-blue-600"
        />
        <MetricCard
          title="Avg ROAS"
          value={`${kpis.avgRoas.toFixed(2)}x`}
          trend={kpis.avgRoas >= 2 ? "Above target" : "Below 2x target"}
          trendUp={kpis.avgRoas >= 2}
          icon={TrendingUp}
          color="bg-purple-100 text-purple-600"
        />
        <MetricCard
          title="Impressions"
          value={kpis.totalImpressions >= 1000000
            ? `${(kpis.totalImpressions / 1000000).toFixed(1)}M`
            : `${(kpis.totalImpressions / 1000).toFixed(0)}K`}
          trend={hasData ? "Total period" : "No data"}
          trendUp={hasData}
          icon={Eye}
          color="bg-indigo-100 text-indigo-600"
        />
        <MetricCard
          title="Conversions"
          value={kpis.totalConversions.toLocaleString()}
          trend={hasData ? "Total period" : "No data"}
          trendUp={kpis.totalConversions > 0}
          icon={MousePointer}
          color="bg-emerald-100 text-emerald-600"
        />
      </div>

      {/* Charts */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="h-8 w-8 mb-3 opacity-50" />
          <p className="text-sm">No ads insights data available</p>
          <p className="text-xs mt-1">Click "Fetch Campaigns" to sync data from Meta</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Daily Spend (AED)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="metaSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Area type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#metaSpend)" name="Spend (AED)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Daily Conversions</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Bar dataKey="conversions" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Conversions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* AI Insight Panel */}
      {aiInsight && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">AI Analysis</h3>
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiInsight}</div>
        </div>
      )}
    </div>
  );
}
