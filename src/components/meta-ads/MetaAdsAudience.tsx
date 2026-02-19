// ═══════════════════════════════════════════════════════════
// Meta Ads Audience Breakdown — Age, Gender, Placement
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Users, Download, RefreshCw, BarChart3, TrendingUp,
} from 'lucide-react';
import type { AudienceBreakdown } from '@/types/metaAds';

function downloadCSV(headers: string[], rows: (string | number | undefined)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function metricColor(metric: string, value: number): string {
  if (metric === 'cpa') return value <= 300 ? 'text-emerald-400' : value <= 500 ? 'text-amber-400' : 'text-red-400';
  return 'text-zinc-300';
}

interface MetaAdsAudienceProps {
  audience: AudienceBreakdown;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function MetaAdsAudience({ audience, isLoading, onRefresh }: MetaAdsAudienceProps) {
  const hasData = audience.by_age.length > 0 || audience.by_gender.length > 0 || audience.by_placement.length > 0;

  const totalSpend = useMemo(() => audience.by_age.reduce((s, a) => s + (a.spend ?? 0), 0), [audience.by_age]);

  const exportAll = () => {
    const headers = ['Segment', 'Type', 'Spend (AED)', 'Conversions', 'CPA (AED)', '% of Spend'];
    const rows = [
      ...audience.by_age.map(a => [a.range, 'Age', a.spend, a.conversions, a.cpa?.toFixed(0), totalSpend > 0 ? ((a.spend / totalSpend) * 100).toFixed(1) : '0']),
      ...audience.by_gender.map(g => [g.gender, 'Gender', g.spend, g.conversions, g.cpa?.toFixed(0), totalSpend > 0 ? ((g.spend / totalSpend) * 100).toFixed(1) : '0']),
      ...audience.by_placement.map(p => [p.placement, 'Placement', p.spend, p.conversions, p.cpa?.toFixed(0), totalSpend > 0 ? ((p.spend / totalSpend) * 100).toFixed(1) : '0']),
    ];
    downloadCSV(headers, rows, 'meta-ads-audience');
  };

  if (!hasData && !isLoading) {
    return (
      <div className="text-center py-12 text-sm text-zinc-500">
        <Users className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
        <p>No audience data loaded.</p>
        <Button variant="outline" size="sm" onClick={onRefresh} className="mt-3 gap-1.5 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> Load Audience Data
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" /> Audience Breakdown
          </h2>
          <p className="text-xs text-zinc-500">Who sees your ads and who converts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportAll} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="age" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="age" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            Age ({audience.by_age.length})
          </TabsTrigger>
          <TabsTrigger value="gender" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            Gender ({audience.by_gender.length})
          </TabsTrigger>
          <TabsTrigger value="placement" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            Placement ({audience.by_placement.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="age">
          <SegmentTable
            data={audience.by_age.map(a => ({ segment: a.range, spend: a.spend, conversions: a.conversions, cpa: a.cpa }))}
            totalSpend={totalSpend}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="gender">
          <SegmentTable
            data={audience.by_gender.map(g => ({ segment: g.gender, spend: g.spend, conversions: g.conversions, cpa: g.cpa }))}
            totalSpend={totalSpend}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="placement">
          <SegmentTable
            data={audience.by_placement.map(p => ({ segment: p.placement, spend: p.spend, conversions: p.conversions, cpa: p.cpa }))}
            totalSpend={totalSpend}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Segment Table with visual bars ───────────────────────

function SegmentTable({
  data,
  totalSpend,
  isLoading,
}: {
  data: Array<{ segment: string; spend: number; conversions: number; cpa: number }>;
  totalSpend: number;
  isLoading: boolean;
}) {
  if (isLoading && data.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-12 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-center py-6 text-sm text-zinc-500">No data for this breakdown.</p>;
  }

  const maxSpend = Math.max(...data.map(d => d.spend), 1);
  const sorted = [...data].sort((a, b) => b.spend - a.spend);

  // Find best CPA
  const bestCPA = Math.min(...data.filter(d => d.conversions > 0).map(d => d.cpa));

  return (
    <div className="space-y-3">
      {/* Visual bar chart */}
      <div className="space-y-1.5">
        {sorted.map((item, i) => {
          const pct = totalSpend > 0 ? (item.spend / totalSpend) * 100 : 0;
          const barWidth = Math.max(2, (item.spend / maxSpend) * 100);
          const isBest = item.cpa === bestCPA && item.conversions > 0;
          return (
            <div key={item.segment} className="group">
              <div className="flex items-center gap-3">
                <div className="w-24 text-xs text-zinc-300 font-medium shrink-0">
                  {item.segment}
                  {isBest && <TrendingUp className="w-3 h-3 text-emerald-400 inline ml-1" />}
                </div>
                <div className="flex-1 h-7 bg-zinc-900 rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-500 group-hover:opacity-90"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: isBest ? '#10b981' : item.cpa <= 300 ? '#3b82f6' : item.cpa <= 500 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] text-white/90 font-medium drop-shadow">
                      {item.spend.toLocaleString()} AED ({pct.toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="w-16 text-right text-xs text-zinc-400 shrink-0">{item.conversions} conv</div>
                <div className={`w-20 text-right text-xs font-medium shrink-0 ${metricColor('cpa', item.cpa)}`}>
                  {item.conversions > 0 ? `${item.cpa.toFixed(0)} AED` : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-800">
        <Card className="border-zinc-800">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-zinc-500">Total Spend</p>
            <p className="text-sm font-semibold text-zinc-100">{totalSpend.toLocaleString()} AED</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-zinc-500">Total Conversions</p>
            <p className="text-sm font-semibold text-zinc-100">{data.reduce((s, d) => s + d.conversions, 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-zinc-500">Best CPA Segment</p>
            <p className="text-sm font-semibold text-emerald-400">
              {data.filter(d => d.cpa === bestCPA && d.conversions > 0)[0]?.segment ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60">
              <TableHead className="text-xs">Segment</TableHead>
              <TableHead className="text-xs">Spend (AED)</TableHead>
              <TableHead className="text-xs">% of Total</TableHead>
              <TableHead className="text-xs">Conversions</TableHead>
              <TableHead className="text-xs">CPA (AED)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow key={item.segment} className="hover:bg-muted/30 transition-colors duration-200">
                <TableCell className="text-xs text-zinc-200 font-medium">{item.segment}</TableCell>
                <TableCell className="text-xs text-zinc-300">{item.spend.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-zinc-400">{totalSpend > 0 ? ((item.spend / totalSpend) * 100).toFixed(1) : 0}%</TableCell>
                <TableCell className="text-xs text-zinc-300 font-medium">{item.conversions}</TableCell>
                <TableCell className={`text-xs font-medium ${metricColor('cpa', item.cpa)}`}>
                  {item.conversions > 0 ? item.cpa.toFixed(0) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
