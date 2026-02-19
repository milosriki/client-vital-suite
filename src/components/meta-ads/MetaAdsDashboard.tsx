import { useEffect, useState, useMemo, useCallback } from 'react';
import { useMetaAds, type TokenStats } from '@/hooks/useMetaAds';
import { updateCampaignStatus } from '@/lib/metaAdsApi';
import type {
  CampaignData,
  AdSetData,
  AdData,
  PerformanceAlert,
  BudgetRecommendation,
  TimeRange,
  CrossValidationMetrics,
  BrandFilter,
} from '@/types/metaAds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  Pause, Play, Download, Zap, Target, BarChart3, ArrowUpDown,
  CheckCircle, XCircle, Info, ArrowUp, ArrowDown, Minus, Filter,
  ShieldAlert, Layers, FileBarChart, ChevronRight,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// COLOR CODING SYSTEM
// ═══════════════════════════════════════════════════════════

const METRIC_THRESHOLDS = {
  roas: { good: 4.0, warning: 2.0, direction: 'higher' as const },
  cpa: { good: 300, warning: 500, direction: 'lower' as const },
  ctr: { good: 0.02, warning: 0.01, direction: 'higher' as const },
  frequency: { good: 2.0, warning: 3.0, direction: 'lower' as const },
} as const;

type MetricKey = keyof typeof METRIC_THRESHOLDS;

function getMetricColor(metric: MetricKey, value: number): string {
  const threshold = METRIC_THRESHOLDS[metric];
  if (!threshold) return 'text-zinc-300';

  if (threshold.direction === 'higher') {
    if (value >= threshold.good) return 'text-emerald-400';
    if (value >= threshold.warning) return 'text-amber-400';
    return 'text-red-400';
  }
  // lower is better
  if (value <= threshold.good) return 'text-emerald-400';
  if (value <= threshold.warning) return 'text-amber-400';
  return 'text-red-400';
}

function getMetricBg(metric: MetricKey, value: number): string {
  const threshold = METRIC_THRESHOLDS[metric];
  if (!threshold) return '';

  if (threshold.direction === 'higher') {
    if (value >= threshold.good) return 'bg-emerald-500/10';
    if (value >= threshold.warning) return 'bg-amber-500/10';
    return 'bg-red-500/10';
  }
  if (value <= threshold.good) return 'bg-emerald-500/10';
  if (value <= threshold.warning) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

// ─── CSV Export helper ────────────────────────────────────
function downloadCSV(headers: string[], rows: (string | number | undefined)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => v ?? '').join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Brand filter helper ─────────────────────────────────
function matchesBrand(name: string, brand: BrandFilter): boolean {
  if (brand === 'all') return true;
  const lower = name?.toLowerCase() ?? '';
  if (brand === 'ptd_fitness') return lower.includes('ptd') || lower.includes('fitness');
  if (brand === 'personal_trainers_dubai') return lower.includes('personal trainer') || lower.includes('pt dubai');
  return true;
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════

export default function MetaAdsDashboard() {
  const {
    dashboard,
    loadDashboard,
    loadBudgetRecs,
    loadCrossValidation,
    loadAdSets,
    loadAds,
    selectedCampaign,
    setSelectedCampaign,
    selectedAdSet,
    setSelectedAdSet,
    computedAlerts,
    tokenStats,
  } = useMetaAds({ dailyBudget: 10, defaultAccountId: 'act_349832333681399' });

  const [timeRange, setTimeRange] = useState<TimeRange>('last_7d');
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all');
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  useEffect(() => {
    loadDashboard(timeRange, ['campaigns', 'alerts']);
  }, [timeRange, loadDashboard]);

  const filteredCampaigns = useMemo(
    () => dashboard.campaigns.filter(c => matchesBrand(c.campaign_name, brandFilter)),
    [dashboard.campaigns, brandFilter]
  );

  const handleCampaignClick = useCallback(async (campaign: CampaignData) => {
    setSelectedCampaign(campaign);
    setSelectedAdSet(null);
    setDrilldownOpen(true);
    await loadAdSets(campaign.campaign_id, timeRange);
  }, [loadAdSets, setSelectedCampaign, setSelectedAdSet, timeRange]);

  const handleAdSetClick = useCallback(async (adSet: AdSetData) => {
    setSelectedAdSet(adSet);
    await loadAds(adSet.adset_id, timeRange);
  }, [loadAds, setSelectedAdSet, timeRange]);

  const timeRanges: Array<{ label: string; value: TimeRange }> = [
    { label: 'Today', value: 'today' },
    { label: '7D', value: 'last_7d' },
    { label: '14D', value: 'last_14d' },
    { label: '30D', value: 'last_30d' },
    { label: 'This Month', value: 'this_month' },
  ];

  const brandOptions: Array<{ label: string; value: BrandFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'PTD Fitness', value: 'ptd_fitness' },
    { label: 'PT Dubai', value: 'personal_trainers_dubai' },
  ];

  return (
    <div className="space-y-4">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Meta Ads Intelligence
          </h2>
          <p className="text-xs text-zinc-500">
            {dashboard.lastUpdated
              ? `Updated ${dashboard.lastUpdated.toLocaleTimeString()}`
              : 'Not loaded yet'}
            {dashboard.isLoading && ' • Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Brand Filter */}
          <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500 self-center mx-1.5" />
            {brandOptions.map((b) => (
              <button
                key={b.value}
                onClick={() => setBrandFilter(b.value)}
                className={`px-2 py-1 rounded-md text-xs transition-colors duration-200 cursor-pointer ${
                  brandFilter === b.value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-muted/30'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          {/* Time Range */}
          <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
            {timeRanges.map((tr) => (
              <button
                key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors duration-200 cursor-pointer ${
                  timeRange === tr.value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-muted/30'
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
            className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dashboard.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ──────────────────────────────────── */}
      <KPICards campaigns={filteredCampaigns} alerts={computedAlerts} tokenStats={tokenStats} />

      {/* ─── Error Banner ───────────────────────────────── */}
      {dashboard.error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          {dashboard.error}
        </div>
      )}

      {/* ─── Main Tabs ──────────────────────────────────── */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="campaigns" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <BarChart3 className="w-3.5 h-3.5" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Alerts {computedAlerts.length > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-1 px-1.5 py-0">{computedAlerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="crossval"
            className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
            onClick={() => { if (!dashboard.crossValidation) loadCrossValidation(); }}
          >
            <Target className="w-3.5 h-3.5" /> Cross-Validation
          </TabsTrigger>
          <TabsTrigger
            value="budget"
            className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
            onClick={() => { if (dashboard.budgetRecs.length === 0) loadBudgetRecs(); }}
          >
            <DollarSign className="w-3.5 h-3.5" /> Budget
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Zap className="w-3.5 h-3.5" /> Tokens (${tokenStats.todayCost.toFixed(2)})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignsTable
            campaigns={filteredCampaigns}
            isLoading={dashboard.isLoading}
            onCampaignClick={handleCampaignClick}
          />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsTable alerts={computedAlerts} />
        </TabsContent>

        <TabsContent value="crossval">
          <CrossValidationPanel data={dashboard.crossValidation} isLoading={dashboard.isLoading} />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetRecsList recs={dashboard.budgetRecs} isLoading={dashboard.isLoading} />
        </TabsContent>

        <TabsContent value="tokens">
          <TokenStatsPanel stats={tokenStats} />
        </TabsContent>
      </Tabs>

      {/* ─── Drill-down Dialog ──────────────────────────── */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <Layers className="w-4 h-4 text-blue-400" />
              {selectedAdSet
                ? `Ads in: ${selectedAdSet.adset_name}`
                : selectedCampaign
                  ? `Ad Sets in: ${selectedCampaign.campaign_name}`
                  : 'Drill-Down'
              }
            </DialogTitle>
          </DialogHeader>

          {/* Breadcrumb */}
          {selectedCampaign && (
            <div className="flex items-center gap-1 text-xs text-zinc-500 mb-2">
              <button
                onClick={() => {
                  setSelectedAdSet(null);
                  if (selectedCampaign) loadAdSets(selectedCampaign.campaign_id, timeRange);
                }}
                className="cursor-pointer hover:text-zinc-300 hover:bg-muted/30 transition-colors duration-200 px-1 py-0.5 rounded"
              >
                {selectedCampaign.campaign_name}
              </button>
              {selectedAdSet && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-zinc-300">{selectedAdSet.adset_name}</span>
                </>
              )}
            </div>
          )}

          {selectedAdSet ? (
            <AdsTable ads={dashboard.ads} isLoading={dashboard.isLoading} />
          ) : (
            <AdSetsTable
              adSets={dashboard.adSets}
              isLoading={dashboard.isLoading}
              onAdSetClick={handleAdSetClick}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KPI CARDS
// ═══════════════════════════════════════════════════════════

function KPICards({
  campaigns,
  alerts,
  tokenStats,
}: {
  campaigns: CampaignData[];
  alerts: PerformanceAlert[];
  tokenStats: TokenStats;
}) {
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend ?? 0), 0);
  const totalConversions = campaigns.reduce((s, c) => s + (c.conversions ?? 0), 0);
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const totalRevenue = campaigns.reduce((s, c) => s + (c.spend ?? 0) * (c.roas ?? 0), 0);
  const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

  const cards = [
    {
      label: 'Total Spend',
      value: `${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED`,
      sub: `${activeCampaigns} active campaigns`,
      icon: DollarSign,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Results',
      value: totalConversions.toLocaleString(),
      sub: `CPA: ${avgCPA.toFixed(0)} AED`,
      icon: Target,
      color: getMetricColor('cpa', avgCPA),
      bgColor: getMetricBg('cpa', avgCPA),
    },
    {
      label: 'Avg CPA',
      value: `${avgCPA.toFixed(0)} AED`,
      sub: avgCPA <= 300 ? 'On target' : avgCPA <= 500 ? 'Above target' : 'Critical',
      icon: avgCPA <= 300 ? TrendingDown : TrendingUp,
      color: getMetricColor('cpa', avgCPA),
      bgColor: getMetricBg('cpa', avgCPA),
    },
    {
      label: 'Avg ROAS',
      value: `${avgROAS.toFixed(2)}x`,
      sub: criticalAlerts > 0 ? `${criticalAlerts} critical alerts` : 'All targets met',
      icon: avgROAS >= 4 ? TrendingUp : avgROAS >= 2 ? Minus : TrendingDown,
      color: getMetricColor('roas', avgROAS),
      bgColor: getMetricBg('roas', avgROAS),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className={`border-zinc-800 ${card.bgColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500 font-medium">{card.label}</p>
              <div className={`p-1.5 rounded-md ${card.bgColor}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CAMPAIGNS TABLE
// ═══════════════════════════════════════════════════════════

function CampaignsTable({
  campaigns,
  isLoading,
  onCampaignClick,
}: {
  campaigns: CampaignData[];
  isLoading: boolean;
  onCampaignClick: (c: CampaignData) => void;
}) {
  const [sortKey, setSortKey] = useState<keyof CampaignData>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      }
      return sortDir === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
    });
  }, [campaigns, sortKey, sortDir]);

  const toggleSort = (key: keyof CampaignData) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleToggleStatus = async (e: React.MouseEvent, campaign: CampaignData) => {
    e.stopPropagation();
    setTogglingId(campaign.campaign_id);
    try {
      const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await updateCampaignStatus(campaign.campaign_id, newStatus);
    } finally {
      setTogglingId(null);
    }
  };

  const exportCSV = () => {
    const headers = ['Campaign', 'Status', 'Spend (AED)', 'Budget (AED)', 'Conversions', 'CPA (AED)', 'ROAS', 'CTR %', 'Reach', 'Frequency', 'Quality'];
    const rows = sorted.map(c => [
      c.campaign_name, c.status, c.spend, c.daily_budget ?? '', c.conversions,
      c.cpa?.toFixed(0), c.roas?.toFixed(2), c.ctr?.toFixed(2),
      c.reach ?? '', c.frequency ?? '', c.quality_ranking ?? '',
    ]);
    downloadCSV(headers, rows, 'meta-ads-campaigns');
  };

  if (isLoading && campaigns.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-14 animate-pulse" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">
        <BarChart3 className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
        No campaign data. Click Refresh to load.
      </div>
    );
  }

  const columns: Array<{ key: keyof CampaignData; label: string }> = [
    { key: 'campaign_name', label: 'Campaign' },
    { key: 'status', label: 'Status' },
    { key: 'spend', label: 'Spend' },
    { key: 'daily_budget', label: 'Budget' },
    { key: 'conversions', label: 'Results' },
    { key: 'cpa', label: 'CPA' },
    { key: 'roas', label: 'ROAS' },
    { key: 'ctr', label: 'CTR' },
    { key: 'reach', label: 'Reach' },
    { key: 'frequency', label: 'Freq' },
    { key: 'quality_ranking', label: 'Quality' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200 hover:bg-muted/30 transition-colors duration-200"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && <ArrowUpDown className="w-3 h-3 text-blue-400" />}
                  </span>
                </TableHead>
              ))}
              <TableHead className="text-xs font-medium text-zinc-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c, i) => (
              <TableRow
                key={c.campaign_id || i}
                onClick={() => onCampaignClick(c)}
                className="cursor-pointer hover:bg-muted/30 transition-colors duration-200"
              >
                <TableCell className="text-xs text-zinc-200 font-medium truncate max-w-[200px]">
                  <span className="flex items-center gap-1">
                    {c.campaign_name}
                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-zinc-300">{(c.spend ?? 0).toLocaleString()} AED</TableCell>
                <TableCell className="text-xs text-zinc-300">{c.daily_budget ? `${c.daily_budget.toLocaleString()} AED` : '—'}</TableCell>
                <TableCell className="text-xs text-zinc-300 font-medium">{(c.conversions ?? 0).toLocaleString()}</TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('cpa', c.cpa ?? 0)}`}>
                  {(c.cpa ?? 0).toFixed(0)} AED
                </TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('roas', c.roas ?? 0)}`}>
                  {(c.roas ?? 0).toFixed(2)}x
                </TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('ctr', c.ctr ?? 0)}`}>
                  {((c.ctr ?? 0) * 100).toFixed(2)}%
                </TableCell>
                <TableCell className="text-xs text-zinc-300">{(c.reach ?? 0).toLocaleString()}</TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('frequency', c.frequency ?? 0)}`}>
                  {(c.frequency ?? 0).toFixed(1)}
                </TableCell>
                <TableCell>
                  {c.quality_ranking && (
                    <Badge
                      variant={c.quality_ranking?.toLowerCase().includes('below') ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {c.quality_ranking}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleToggleStatus(e, c)}
                    disabled={togglingId === c.campaign_id}
                    className="h-7 px-2 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                  >
                    {c.status === 'ACTIVE'
                      ? <Pause className="w-3.5 h-3.5 text-amber-400" />
                      : <Play className="w-3.5 h-3.5 text-emerald-400" />
                    }
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AD SETS TABLE (Drill-down)
// ═══════════════════════════════════════════════════════════

function AdSetsTable({
  adSets,
  isLoading,
  onAdSetClick,
}: {
  adSets: AdSetData[];
  isLoading: boolean;
  onAdSetClick: (a: AdSetData) => void;
}) {
  if (isLoading && adSets.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-12 animate-pulse" />
        ))}
      </div>
    );
  }

  if (adSets.length === 0) {
    return <div className="text-center py-6 text-sm text-zinc-500">No ad sets found.</div>;
  }

  const exportCSV = () => {
    const headers = ['Ad Set', 'Status', 'Spend', 'Budget', 'Conversions', 'CPA', 'ROAS', 'Reach', 'Frequency', 'Quality'];
    const rows = adSets.map(a => [
      a.adset_name, a.status, a.spend, a.daily_budget, a.conversions,
      a.cpa?.toFixed(0), a.roas?.toFixed(2), a.reach, a.frequency?.toFixed(1), a.quality_ranking,
    ]);
    downloadCSV(headers, rows, 'meta-ads-adsets');
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60">
              <TableHead className="text-xs">Ad Set</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Spend</TableHead>
              <TableHead className="text-xs">Results</TableHead>
              <TableHead className="text-xs">CPA</TableHead>
              <TableHead className="text-xs">ROAS</TableHead>
              <TableHead className="text-xs">Reach</TableHead>
              <TableHead className="text-xs">Freq</TableHead>
              <TableHead className="text-xs">Quality</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adSets.map((a, i) => (
              <TableRow
                key={a.adset_id || i}
                onClick={() => onAdSetClick(a)}
                className="cursor-pointer hover:bg-muted/30 transition-colors duration-200"
              >
                <TableCell className="text-xs text-zinc-200 font-medium">
                  <span className="flex items-center gap-1">
                    {a.adset_name}
                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">{a.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-zinc-300">{(a.spend ?? 0).toLocaleString()} AED</TableCell>
                <TableCell className="text-xs text-zinc-300 font-medium">{(a.conversions ?? 0).toLocaleString()}</TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('cpa', a.cpa ?? 0)}`}>
                  {(a.cpa ?? 0).toFixed(0)} AED
                </TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('roas', a.roas ?? 0)}`}>
                  {(a.roas ?? 0).toFixed(2)}x
                </TableCell>
                <TableCell className="text-xs text-zinc-300">{(a.reach ?? 0).toLocaleString()}</TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('frequency', a.frequency ?? 0)}`}>
                  {(a.frequency ?? 0).toFixed(1)}
                </TableCell>
                <TableCell>
                  {a.quality_ranking && (
                    <Badge variant={a.quality_ranking?.toLowerCase().includes('below') ? 'destructive' : 'secondary'} className="text-[10px]">
                      {a.quality_ranking}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ADS TABLE (Drill-down level 2)
// ═══════════════════════════════════════════════════════════

function AdsTable({ ads, isLoading }: { ads: AdData[]; isLoading: boolean }) {
  if (isLoading && ads.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-12 animate-pulse" />
        ))}
      </div>
    );
  }

  if (ads.length === 0) {
    return <div className="text-center py-6 text-sm text-zinc-500">No ads found.</div>;
  }

  const exportCSV = () => {
    const headers = ['Ad', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'CTR %', 'CPA', 'ROAS'];
    const rows = ads.map(a => [
      a.ad_name, a.spend, a.impressions, a.clicks, a.conversions,
      a.ctr?.toFixed(2), a.cpa?.toFixed(0), a.roas?.toFixed(2),
    ]);
    downloadCSV(headers, rows, 'meta-ads-ads');
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60">
              <TableHead className="text-xs">Ad</TableHead>
              <TableHead className="text-xs">Spend</TableHead>
              <TableHead className="text-xs">Impr</TableHead>
              <TableHead className="text-xs">Clicks</TableHead>
              <TableHead className="text-xs">Results</TableHead>
              <TableHead className="text-xs">CTR</TableHead>
              <TableHead className="text-xs">CPA</TableHead>
              <TableHead className="text-xs">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.map((a, i) => (
              <TableRow key={a.ad_id || i} className="hover:bg-muted/30 transition-colors duration-200">
                <TableCell className="text-xs text-zinc-200 font-medium truncate max-w-[200px]">{a.ad_name}</TableCell>
                <TableCell className="text-xs text-zinc-300">{(a.spend ?? 0).toLocaleString()} AED</TableCell>
                <TableCell className="text-xs text-zinc-300">{(a.impressions ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-xs text-zinc-300">{(a.clicks ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-xs text-zinc-300 font-medium">{(a.conversions ?? 0).toLocaleString()}</TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('ctr', a.ctr ?? 0)}`}>
                  {((a.ctr ?? 0) * 100).toFixed(2)}%
                </TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('cpa', a.cpa ?? 0)}`}>
                  {(a.cpa ?? 0).toFixed(0)} AED
                </TableCell>
                <TableCell className={`text-xs font-medium ${getMetricColor('roas', a.roas ?? 0)}`}>
                  {(a.roas ?? 0).toFixed(2)}x
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ALERTS TABLE
// ═══════════════════════════════════════════════════════════

function AlertsTable({ alerts }: { alerts: PerformanceAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">
        <CheckCircle className="w-8 h-8 mx-auto mb-3 text-emerald-600" />
        No alerts. All campaigns are within targets.
      </div>
    );
  }

  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  const severityIcon: Record<string, typeof XCircle> = {
    critical: XCircle,
    warning: AlertTriangle,
    info: Info,
  };
  const severityBadge: Record<string, 'destructive' | 'secondary' | 'default'> = {
    critical: 'destructive',
    warning: 'secondary',
    info: 'default',
  };

  const exportCSV = () => {
    const headers = ['Campaign', 'Alert Type', 'Severity', 'Metric', 'Value', 'Threshold', 'Recommendation'];
    const rows = sorted.map(a => [
      a.campaign_name, a.alert_type, a.severity, a.metric, a.value, a.threshold, a.recommendation,
    ]);
    downloadCSV(headers, rows, 'meta-ads-alerts');
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60">
              <TableHead className="text-xs">Campaign</TableHead>
              <TableHead className="text-xs">Alert</TableHead>
              <TableHead className="text-xs">Severity</TableHead>
              <TableHead className="text-xs">Value</TableHead>
              <TableHead className="text-xs">Threshold</TableHead>
              <TableHead className="text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((alert, i) => {
              const Icon = severityIcon[alert.severity] ?? Info;
              return (
                <TableRow key={i} className="hover:bg-muted/30 transition-colors duration-200">
                  <TableCell className="text-xs text-zinc-200 font-medium">{alert.campaign_name}</TableCell>
                  <TableCell className="text-xs text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      {alert.alert_type?.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={severityBadge[alert.severity] ?? 'default'} className="text-[10px]">
                      {alert.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-300 font-medium">
                    {typeof alert.value === 'number' ? alert.value.toFixed(1) : String(alert.value ?? '—')}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {typeof alert.threshold === 'number' ? alert.threshold.toFixed(1) : String(alert.threshold ?? '—')}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400 max-w-[250px] truncate">{alert.recommendation}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CROSS-VALIDATION PANEL
// ═══════════════════════════════════════════════════════════

function CrossValidationPanel({ data, isLoading }: { data: CrossValidationMetrics | null; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">
        <Target className="w-8 h-8 mx-auto mb-3 text-zinc-600 animate-pulse" />
        Loading cross-validation data...
      </div>
    );
  }

  const metrics = [
    {
      label: 'CPA / CPL',
      meta: `${data.meta_reported?.cpa?.toFixed(0) ?? '—'} AED`,
      real: `${data.real?.real_cpl?.toFixed(0) ?? '—'} AED`,
      diff: data.discrepancy?.cpa_diff_percent ?? 0,
      better: (data.discrepancy?.cpa_diff_percent ?? 0) < 0,
    },
    {
      label: 'ROAS',
      meta: `${data.meta_reported?.roas?.toFixed(2) ?? '—'}x`,
      real: `${data.real?.real_roas?.toFixed(2) ?? '—'}x`,
      diff: data.discrepancy?.roas_diff_percent ?? 0,
      better: (data.discrepancy?.roas_diff_percent ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-400" />
            Meta-Reported vs Real Metrics (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="text-sm text-zinc-300 font-medium w-24">{m.label}</div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500 mb-0.5">Meta Reported</p>
                  <p className="text-sm text-zinc-400">{m.meta}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500 mb-0.5">Real (HubSpot/Stripe)</p>
                  <p className="text-sm text-zinc-100 font-semibold">{m.real}</p>
                </div>
                <Badge
                  variant={m.better ? 'default' : 'destructive'}
                  className="text-[10px]"
                >
                  {m.better ? <ArrowUp className="w-3 h-3 mr-0.5" /> : <ArrowDown className="w-3 h-3 mr-0.5" />}
                  {Math.abs(m.diff).toFixed(0)}%
                </Badge>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
            <Card className="border-zinc-800">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-zinc-500">HubSpot New Contacts</p>
                <p className="text-lg font-semibold text-zinc-100">{data.real?.hubspot_new_contacts ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-zinc-500">Stripe Revenue</p>
                <p className="text-lg font-semibold text-zinc-100">{(data.real?.stripe_revenue ?? 0).toLocaleString()} AED</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Inline ArrowRight since lucide might not export it in all versions
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// BUDGET RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════

function BudgetRecsList({ recs, isLoading }: { recs: BudgetRecommendation[]; isLoading: boolean }) {
  if (isLoading && recs.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-14 animate-pulse" />
        ))}
      </div>
    );
  }
  if (recs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">
        <FileBarChart className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
        No recommendations yet. Loading...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recs.map((rec, i) => {
        const change = (rec.recommended_daily_budget ?? 0) - (rec.current_daily_budget ?? 0);
        const changePercent = (rec.current_daily_budget ?? 0) > 0
          ? ((change / rec.current_daily_budget) * 100).toFixed(0)
          : '—';
        const isIncrease = change > 0;
        return (
          <Card key={i} className="border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-200">{rec.campaign_name}</span>
                <span className={`text-sm font-semibold flex items-center gap-1 ${isIncrease ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {changePercent}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span>Current: {(rec.current_daily_budget ?? 0).toLocaleString()} AED/day</span>
                <span className="text-zinc-600">→</span>
                <span className="text-zinc-200 font-medium">{(rec.recommended_daily_budget ?? 0).toLocaleString()} AED/day</span>
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
          <Card key={item.label} className="border-zinc-800">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
              <p className="text-lg font-semibold text-zinc-100">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-zinc-800">
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

      {stats.last7Days.length > 0 && (
        <Card className="border-zinc-800">
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

      {Object.keys(stats.byModel).length > 0 && (
        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-400 mb-2">Model Usage Today</p>
            <div className="space-y-1.5">
              {Object.entries(stats.byModel).map(([model, data]) => (
                <div key={model} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{model}</span>
                  <span className="text-zinc-500">{data.queries} queries • ${data.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
