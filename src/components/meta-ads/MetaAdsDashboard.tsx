import { useEffect, useState } from 'react';
import { useMetaAds, type TokenStats } from '@/hooks/useMetaAds';
import { updateCampaignStatus } from '@/lib/metaAdsApi';
import type { CampaignData, PerformanceAlert, BudgetRecommendation, TimeRange, CrossValidationMetrics } from '@/types/metaAds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  Pause, Play, Download, Zap, Target, BarChart3, Users, ArrowUpDown,
  CheckCircle, XCircle, Info,
} from 'lucide-react';

export default function MetaAdsDashboard() {
  const {
    dashboard,
    loadDashboard,
    loadBudgetRecs,
    loadCrossValidation,
    tokenStats,
  } = useMetaAds({ dailyBudget: 10, defaultAccountId: 'act_349832333681399' });

  const [timeRange, setTimeRange] = useState<TimeRange>('last_7d');
  const [activeTab, setActiveTab] = useState<'campaigns' | 'alerts' | 'budget' | 'crossval' | 'tokens'>('campaigns');

  useEffect(() => {
    loadDashboard(timeRange, ['campaigns', 'alerts']);
  }, [timeRange, loadDashboard]);

  const timeRanges: Array<{ label: string; value: TimeRange }> = [
    { label: 'Today', value: 'today' },
    { label: '7 Days', value: 'last_7d' },
    { label: '14 Days', value: 'last_14d' },
    { label: '30 Days', value: 'last_30d' },
    { label: 'This Month', value: 'this_month' },
  ];

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Meta Ads Dashboard</h2>
          <p className="text-xs text-zinc-500">
            {dashboard.lastUpdated
              ? `Updated ${dashboard.lastUpdated.toLocaleTimeString()}`
              : 'Not loaded yet'}
            {dashboard.isLoading && ' \u2022 Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
            {timeRanges.map((tr) => (
              <button
                key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  timeRange === tr.value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(timeRange, ['campaigns', 'alerts', 'budget'])}
            disabled={dashboard.isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dashboard.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards campaigns={dashboard.campaigns} alerts={dashboard.alerts} tokenStats={tokenStats} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 pb-px">
        {([
          { key: 'campaigns' as const, label: 'Campaigns', icon: BarChart3 },
          { key: 'alerts' as const, label: `Alerts${dashboard.alerts.length > 0 ? ` (${dashboard.alerts.length})` : ''}`, icon: AlertTriangle },
          { key: 'budget' as const, label: 'Budget Recs', icon: DollarSign },
          { key: 'crossval' as const, label: 'Cross-Validation', icon: Target },
          { key: 'tokens' as const, label: `Tokens ($${tokenStats.todayCost.toFixed(2)})`, icon: Zap },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === 'budget' && dashboard.budgetRecs.length === 0) loadBudgetRecs();
              if (tab.key === 'crossval' && !dashboard.crossValidation) loadCrossValidation();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {dashboard.error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
          {dashboard.error}
        </div>
      )}

      {activeTab === 'campaigns' && <CampaignsTable campaigns={dashboard.campaigns} isLoading={dashboard.isLoading} />}
      {activeTab === 'alerts' && <AlertsList alerts={dashboard.alerts} />}
      {activeTab === 'budget' && <BudgetRecsList recs={dashboard.budgetRecs} isLoading={dashboard.isLoading} />}
      {activeTab === 'crossval' && <CrossValidationPanel data={dashboard.crossValidation} isLoading={dashboard.isLoading} />}
      {activeTab === 'tokens' && <TokenStatsPanel stats={tokenStats} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUMMARY CARDS
// ═══════════════════════════════════════════════════════════
function SummaryCards({
  campaigns,
  alerts,
  tokenStats,
}: {
  campaigns: CampaignData[];
  alerts: PerformanceAlert[];
  tokenStats: TokenStats;
}) {
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);
  const totalConversions = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

  const cards = [
    { label: 'Total Spend', value: `${totalSpend.toLocaleString()} AED`, sub: `${activeCampaigns} active`, icon: DollarSign, alert: false },
    { label: 'Conversions', value: totalConversions.toLocaleString(), sub: `CPA: ${avgCPA.toFixed(0)} AED`, icon: Target, alert: avgCPA > 500 },
    { label: 'Alerts', value: alerts.length.toString(), sub: `${criticalAlerts} critical`, icon: AlertTriangle, alert: criticalAlerts > 0 },
    { label: 'API Cost', value: `$${tokenStats.todayCost.toFixed(3)}`, sub: `${tokenStats.todayQueries} queries`, icon: Zap, alert: false },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.alert ? 'border-red-500/30' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-zinc-500">{card.label}</p>
              <card.icon className={`w-4 h-4 ${card.alert ? 'text-red-400' : 'text-zinc-500'}`} />
            </div>
            <p className={`text-xl font-semibold ${card.alert ? 'text-red-400' : 'text-zinc-100'}`}>
              {card.value}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CAMPAIGNS TABLE
// ═══════════════════════════════════════════════════════════
function CampaignsTable({ campaigns, isLoading }: { campaigns: CampaignData[]; isLoading: boolean }) {
  const [sortKey, setSortKey] = useState<keyof CampaignData>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (isLoading && campaigns.length === 0) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-14 animate-pulse" />
    ))}</div>;
  }

  if (campaigns.length === 0) {
    return <div className="text-center py-8 text-sm text-zinc-500">No campaign data. Click Refresh to load.</div>;
  }

  const sorted = [...campaigns].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    }
    return sortDir === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
  });

  const toggleSort = (key: keyof CampaignData) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleToggleStatus = async (campaign: CampaignData) => {
    setTogglingId(campaign.campaign_id);
    try {
      const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await updateCampaignStatus(campaign.campaign_id, newStatus);
    } finally {
      setTogglingId(null);
    }
  };

  const exportCSV = () => {
    const headers = ['Campaign', 'Status', 'Spend (AED)', 'Conversions', 'CPA (AED)', 'ROAS', 'CTR %', 'Impressions'];
    const rows = sorted.map(c => [c.campaign_name, c.status, c.spend, c.conversions, c.cpa?.toFixed(0), c.roas?.toFixed(2), c.ctr?.toFixed(2), c.impressions]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meta-ads-campaigns.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-900/60">
              {[
                { key: 'campaign_name' as keyof CampaignData, label: 'Campaign' },
                { key: 'status' as keyof CampaignData, label: 'Status' },
                { key: 'spend' as keyof CampaignData, label: 'Spend' },
                { key: 'conversions' as keyof CampaignData, label: 'Conv' },
                { key: 'cpa' as keyof CampaignData, label: 'CPA' },
                { key: 'roas' as keyof CampaignData, label: 'ROAS' },
                { key: 'ctr' as keyof CampaignData, label: 'CTR' },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && <ArrowUpDown className="w-3 h-3 text-blue-400" />}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.campaign_id || i} className="border-t border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
                <td className="px-3 py-2.5 text-xs text-zinc-200 font-medium truncate max-w-[200px]">{c.campaign_name}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">
                    {c.status}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-300">{c.spend?.toLocaleString()} AED</td>
                <td className="px-3 py-2.5 text-xs text-zinc-300">{c.conversions?.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-xs">
                  <span className={c.cpa > 500 ? 'text-red-400 font-medium' : 'text-zinc-200'}>
                    {c.cpa?.toFixed(0)} AED
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <span className={c.roas < 2 ? 'text-red-400 font-medium' : c.roas > 3 ? 'text-emerald-400 font-medium' : 'text-zinc-200'}>
                    {c.roas?.toFixed(2)}x
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-300">{c.ctr?.toFixed(2)}%</td>
                <td className="px-3 py-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(c)}
                    disabled={togglingId === c.campaign_id}
                    className="h-7 px-2 cursor-pointer"
                  >
                    {c.status === 'ACTIVE'
                      ? <Pause className="w-3.5 h-3.5 text-amber-400" />
                      : <Play className="w-3.5 h-3.5 text-emerald-400" />
                    }
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ALERTS LIST
// ═══════════════════════════════════════════════════════════
function AlertsList({ alerts }: { alerts: PerformanceAlert[] }) {
  if (alerts.length === 0) return <div className="text-center py-8 text-sm text-zinc-500">No alerts. Campaigns are within targets.</div>;

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const sorted = [...alerts].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const severityIcon = { critical: XCircle, warning: AlertTriangle, info: Info };
  const severityColor = {
    critical: 'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
  };

  return (
    <div className="space-y-2">
      {sorted.map((alert, i) => {
        const Icon = severityIcon[alert.severity];
        return (
          <div key={i} className={`border rounded-xl px-4 py-3 ${severityColor[alert.severity]}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium text-zinc-200">{alert.campaign_name}</span>
                  <Badge variant="outline" className="text-[10px]">{alert.alert_type.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-xs text-zinc-400">{alert.recommendation}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-zinc-200">{typeof alert.value === 'number' ? alert.value.toFixed(1) : alert.value}</p>
                <p className="text-xs text-zinc-500">target: {typeof alert.threshold === 'number' ? alert.threshold.toFixed(1) : alert.threshold}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BUDGET RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════
function BudgetRecsList({ recs, isLoading }: { recs: BudgetRecommendation[]; isLoading: boolean }) {
  if (isLoading && recs.length === 0) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-14 animate-pulse" />
  ))}</div>;
  if (recs.length === 0) return <div className="text-center py-8 text-sm text-zinc-500">No recommendations yet. Loading...</div>;

  return (
    <div className="space-y-2">
      {recs.map((rec, i) => {
        const change = rec.recommended_daily_budget - rec.current_daily_budget;
        const changePercent = rec.current_daily_budget > 0 ? ((change / rec.current_daily_budget) * 100).toFixed(0) : '---';
        const isIncrease = change > 0;
        return (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-200">{rec.campaign_name}</span>
                <span className={`text-sm font-semibold flex items-center gap-1 ${isIncrease ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {changePercent}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span>Current: {rec.current_daily_budget.toLocaleString()} AED/day</span>
                <span className="text-zinc-600">&rarr;</span>
                <span className="text-zinc-200 font-medium">{rec.recommended_daily_budget.toLocaleString()} AED/day</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">{rec.reason}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CROSS-VALIDATION PANEL
// ═══════════════════════════════════════════════════════════
function CrossValidationPanel({ data, isLoading }: { data: CrossValidationMetrics | null; isLoading: boolean }) {
  if (isLoading || !data) {
    return <div className="text-center py-8 text-sm text-zinc-500">Loading cross-validation data...</div>;
  }

  const metrics = [
    {
      label: 'CPA / CPL',
      meta: `${data.meta_reported.cpa.toFixed(0)} AED`,
      real: `${data.real.real_cpl.toFixed(0)} AED`,
      diff: data.discrepancy.cpa_diff_percent,
      goodWhenLower: true,
    },
    {
      label: 'ROAS',
      meta: `${data.meta_reported.roas.toFixed(2)}x`,
      real: `${data.real.real_roas.toFixed(2)}x`,
      diff: data.discrepancy.roas_diff_percent,
      goodWhenLower: false,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            Meta-Reported vs Real Metrics (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            <div className="text-zinc-500 font-medium">Metric</div>
            <div className="text-zinc-500 font-medium">Meta Reported</div>
            <div className="text-zinc-500 font-medium">Real (HubSpot/Stripe)</div>
          </div>
          {metrics.map((m) => (
            <div key={m.label} className="grid grid-cols-3 gap-4 text-center items-center">
              <div className="text-sm text-zinc-300 font-medium">{m.label}</div>
              <div className="text-sm text-zinc-400">{m.meta}</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-zinc-100 font-semibold">{m.real}</span>
                <Badge variant={Math.abs(m.diff) > 20 ? 'destructive' : 'secondary'} className="text-[10px]">
                  {m.diff > 0 ? '+' : ''}{m.diff.toFixed(0)}%
                </Badge>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-zinc-500">HubSpot New Contacts</p>
                <p className="text-lg font-semibold text-zinc-100">{data.real.hubspot_new_contacts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-zinc-500">Stripe Revenue</p>
                <p className="text-lg font-semibold text-zinc-100">{data.real.stripe_revenue.toLocaleString()} AED</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TOKEN STATS PANEL
// ═══════════════════════════════════════════════════════════
function TokenStatsPanel({ stats }: { stats: TokenStats }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Queries Today', value: stats.todayQueries.toString() },
          { label: 'Input Tokens', value: stats.todayInputTokens.toLocaleString() },
          { label: 'Output Tokens', value: stats.todayOutputTokens.toLocaleString() },
          { label: 'Total Cost', value: `$${stats.todayCost.toFixed(4)}` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
              <p className="text-lg font-semibold text-zinc-100">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Daily Budget</span>
            <span className="text-xs text-zinc-300">
              ${stats.todayCost.toFixed(3)} / ${stats.dailyBudget.toFixed(2)}
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (stats.todayCost / stats.dailyBudget) * 100)}%`,
                backgroundColor: stats.isOverBudget ? '#ef4444' : (stats.todayCost / stats.dailyBudget) > 0.7 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">${stats.remainingBudget.toFixed(3)} remaining</p>
        </CardContent>
      </Card>

      {/* 7-day trend */}
      {stats.last7Days.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-zinc-400 mb-3">Last 7 Days</p>
            <div className="flex items-end gap-1.5 h-20">
              {stats.last7Days.map((day, i) => {
                const maxCost = Math.max(...stats.last7Days.map(d => d.cost), 0.01);
                const height = Math.max(4, (day.cost / maxCost) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500/40 rounded-t transition-all hover:bg-blue-500/60 cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: $${day.cost.toFixed(4)} (${day.queries} queries)`}
                    />
                    <span className="text-[10px] text-zinc-600">{day.date.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model distribution */}
      {Object.keys(stats.byModel).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-zinc-400 mb-2">Model Usage Today</p>
            <div className="space-y-1.5">
              {Object.entries(stats.byModel).map(([model, data]) => (
                <div key={model} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{model}</span>
                  <span className="text-zinc-500">{data.queries} queries \u2022 ${data.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
