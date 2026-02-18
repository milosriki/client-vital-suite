import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Loader2, RefreshCw } from "lucide-react";
import { fetchCampaigns, analyzeBudget } from "@/lib/metaAdsApi";

// Static summary data (will be replaced by AI-fetched data)
const MOCK_DAILY = [
  { date: "Feb 1", spend: 12800, conversions: 42 },
  { date: "Feb 2", spend: 11500, conversions: 38 },
  { date: "Feb 3", spend: 13200, conversions: 51 },
  { date: "Feb 4", spend: 14100, conversions: 48 },
  { date: "Feb 5", spend: 12600, conversions: 44 },
  { date: "Feb 6", spend: 15200, conversions: 62 },
  { date: "Feb 7", spend: 13800, conversions: 55 },
];

function MetricCard({ title, value, trend, trendUp, icon: Icon, color }: {
  title: string; value: string; trend: string; trendUp: boolean;
  icon: typeof DollarSign; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Meta Ads Performance</h2>
          <p className="text-slate-500 text-sm">PTD Fitness — AED 384K monthly budget</p>
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
        <MetricCard title="Monthly Spend" value="AED 384K" trend="On track" trendUp={true} icon={DollarSign} color="bg-blue-100 text-blue-600" />
        <MetricCard title="ROAS" value="2.4x" trend="+0.3 vs last month" trendUp={true} icon={TrendingUp} color="bg-purple-100 text-purple-600" />
        <MetricCard title="Impressions" value="2.1M" trend="-3.2% WoW" trendUp={false} icon={Eye} color="bg-indigo-100 text-indigo-600" />
        <MetricCard title="Conversions" value="1,247" trend="+12.5% WoW" trendUp={true} icon={MousePointer} color="bg-emerald-100 text-emerald-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Daily Spend (AED)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_DAILY}>
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
              <BarChart data={MOCK_DAILY}>
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
