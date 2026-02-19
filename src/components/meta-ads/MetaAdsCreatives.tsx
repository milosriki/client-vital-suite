// ═══════════════════════════════════════════════════════════
// Meta Ads Creative Library — View, manage, upload creatives
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Image as ImageIcon, Video, FileText, Upload, Download, Copy,
  Eye, TrendingUp, TrendingDown, Search, Filter, Grid3X3, List,
  ExternalLink, Sparkles, RefreshCw, Plus, X, Check, AlertTriangle,
} from 'lucide-react';
import type { AdData } from '@/types/metaAds';

// ─── Types ────────────────────────────────────────────────

interface Creative {
  id: string;
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  status: string;
  // Creative content
  thumbnail_url?: string;
  body?: string;
  title?: string;
  description?: string;
  link_url?: string;
  cta_type?: string;
  format?: 'image' | 'video' | 'carousel' | 'collection';
  // Performance
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  // Rankings
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
}

interface UploadedAsset {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  size: number;
  uploadedAt: Date;
}

interface CopyVariant {
  id: string;
  headline: string;
  body: string;
  description?: string;
  cta: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: Date;
}

// ─── CSV export helper ────────────────────────────────────
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

// ─── Metric color helper ──────────────────────────────────
function metricColor(metric: string, value: number): string {
  if (metric === 'cpa') return value <= 300 ? 'text-emerald-400' : value <= 500 ? 'text-amber-400' : 'text-red-400';
  if (metric === 'roas') return value >= 4 ? 'text-emerald-400' : value >= 2 ? 'text-amber-400' : 'text-red-400';
  if (metric === 'ctr') return value >= 0.02 ? 'text-emerald-400' : value >= 0.01 ? 'text-amber-400' : 'text-red-400';
  return 'text-zinc-300';
}

function rankingBadge(ranking?: string) {
  if (!ranking) return null;
  const lower = ranking.toLowerCase();
  if (lower.includes('above')) return <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20">{ranking}</Badge>;
  if (lower.includes('below')) return <Badge variant="destructive" className="text-[10px]">{ranking}</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{ranking}</Badge>;
}

const FORMAT_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  carousel: Grid3X3,
  collection: Grid3X3,
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

interface MetaAdsCreativesProps {
  topCreatives: Array<Record<string, unknown>>;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function MetaAdsCreatives({ topCreatives, isLoading, onRefresh }: MetaAdsCreativesProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [copyEditorOpen, setCopyEditorOpen] = useState(false);

  // Local state for uploaded assets and copy variants
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>(() => {
    try { return JSON.parse(localStorage.getItem('ptd_creative_assets') || '[]'); } catch { return []; }
  });
  const [copyVariants, setCopyVariants] = useState<CopyVariant[]>(() => {
    try { return JSON.parse(localStorage.getItem('ptd_copy_variants') || '[]'); } catch { return []; }
  });

  // Convert raw data to Creative objects
  const creatives: Creative[] = useMemo(() => {
    return topCreatives.map((raw, i) => ({
      id: String(raw.ad_id ?? `creative_${i}`),
      ad_id: String(raw.ad_id ?? ''),
      ad_name: String(raw.ad_name ?? `Ad ${i + 1}`),
      campaign_name: String(raw.campaign_name ?? ''),
      adset_name: String(raw.adset_name ?? ''),
      status: String(raw.status ?? 'ACTIVE'),
      thumbnail_url: raw.creative_thumbnail_url as string | undefined,
      body: raw.creative_body as string | undefined,
      title: raw.creative_title as string | undefined,
      description: raw.creative_description as string | undefined,
      link_url: raw.creative_link_url as string | undefined,
      cta_type: raw.cta_type as string | undefined,
      format: (raw.format as Creative['format']) ?? 'image',
      spend: Number(raw.spend ?? 0),
      impressions: Number(raw.impressions ?? 0),
      clicks: Number(raw.clicks ?? 0),
      conversions: Number(raw.conversions ?? 0),
      ctr: Number(raw.ctr ?? 0),
      cpc: Number(raw.cpc ?? 0),
      cpa: Number(raw.cpa ?? 0),
      roas: Number(raw.roas ?? 0),
      quality_ranking: raw.quality_ranking as string | undefined,
      engagement_rate_ranking: raw.engagement_rate_ranking as string | undefined,
      conversion_rate_ranking: raw.conversion_rate_ranking as string | undefined,
    }));
  }, [topCreatives]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return creatives;
    const q = searchQuery.toLowerCase();
    return creatives.filter(c =>
      c.ad_name.toLowerCase().includes(q) ||
      c.campaign_name.toLowerCase().includes(q) ||
      (c.body ?? '').toLowerCase().includes(q) ||
      (c.title ?? '').toLowerCase().includes(q)
    );
  }, [creatives, searchQuery]);

  const handleCreativeClick = (c: Creative) => {
    setSelectedCreative(c);
    setDetailOpen(true);
  };

  const exportCSV = () => {
    const headers = ['Ad Name', 'Campaign', 'Format', 'Headline', 'Body', 'CTA', 'Link', 'Spend (AED)', 'Impressions', 'Clicks', 'Conversions', 'CTR %', 'CPA (AED)', 'ROAS', 'Quality', 'Engagement', 'Conversion Ranking'];
    const rows = filtered.map(c => [
      c.ad_name, c.campaign_name, c.format, c.title, c.body, c.cta_type, c.link_url,
      c.spend, c.impressions, c.clicks, c.conversions,
      (c.ctr * 100).toFixed(2), c.cpa.toFixed(0), c.roas.toFixed(2),
      c.quality_ranking, c.engagement_rate_ranking, c.conversion_rate_ranking,
    ]);
    downloadCSV(headers, rows, 'meta-ads-creatives');
  };

  const exportCopyVariants = () => {
    const headers = ['Headline', 'Body', 'Description', 'CTA', 'Status', 'Created'];
    const rows = copyVariants.map(v => [v.headline, v.body, v.description, v.cta, v.status, new Date(v.createdAt).toLocaleDateString()]);
    downloadCSV(headers, rows, 'ptd-copy-variants');
  };

  return (
    <div className="space-y-4">
      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Creative Library
          </h2>
          <p className="text-xs text-zinc-500">{filtered.length} creatives • {uploadedAssets.length} uploaded assets • {copyVariants.length} copy variants</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCopyEditorOpen(true)} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <FileText className="w-3.5 h-3.5" /> Copy Editor
          </Button>
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Upload className="w-3.5 h-3.5" /> Upload
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ─── Search + View toggle ───────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search creatives by name, headline, copy..."
            className="pl-10 bg-zinc-900 border-zinc-800 text-sm"
          />
        </div>
        <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded cursor-pointer transition-colors duration-200 ${viewMode === 'grid' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded cursor-pointer transition-colors duration-200 ${viewMode === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Main Tabs ──────────────────────────────── */}
      <Tabs defaultValue="live" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="live" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Sparkles className="w-3.5 h-3.5" /> Live Ads ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <ImageIcon className="w-3.5 h-3.5" /> Assets ({uploadedAssets.length})
          </TabsTrigger>
          <TabsTrigger value="copy" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <FileText className="w-3.5 h-3.5" /> Copy Library ({copyVariants.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          {isLoading && filtered.length === 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl h-64 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-zinc-500">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
              <p>No creatives loaded. Click Refresh to fetch from Meta.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <CreativeGrid creatives={filtered} onClick={handleCreativeClick} />
          ) : (
            <CreativeList creatives={filtered} onClick={handleCreativeClick} />
          )}
        </TabsContent>

        <TabsContent value="assets">
          <AssetLibrary
            assets={uploadedAssets}
            onAssetsChange={(assets) => {
              setUploadedAssets(assets);
              localStorage.setItem('ptd_creative_assets', JSON.stringify(assets));
            }}
          />
        </TabsContent>

        <TabsContent value="copy">
          <CopyLibrary
            variants={copyVariants}
            onVariantsChange={(variants) => {
              setCopyVariants(variants);
              localStorage.setItem('ptd_copy_variants', JSON.stringify(variants));
            }}
            onExport={exportCopyVariants}
          />
        </TabsContent>
      </Tabs>

      {/* ─── Creative Detail Dialog ─────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCreative && <CreativeDetail creative={selectedCreative} />}
        </DialogContent>
      </Dialog>

      {/* ─── Upload Dialog ──────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" /> Upload Creative Assets
            </DialogTitle>
          </DialogHeader>
          <UploadForm
            onUpload={(asset) => {
              const updated = [...uploadedAssets, asset];
              setUploadedAssets(updated);
              localStorage.setItem('ptd_creative_assets', JSON.stringify(updated));
              setUploadOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ─── Copy Editor Dialog ─────────────────────── */}
      <Dialog open={copyEditorOpen} onOpenChange={setCopyEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" /> New Copy Variant
            </DialogTitle>
          </DialogHeader>
          <CopyEditor
            onSave={(variant) => {
              const updated = [...copyVariants, variant];
              setCopyVariants(updated);
              localStorage.setItem('ptd_copy_variants', JSON.stringify(updated));
              setCopyEditorOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CREATIVE GRID VIEW
// ═══════════════════════════════════════════════════════════

function CreativeGrid({ creatives, onClick }: { creatives: Creative[]; onClick: (c: Creative) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {creatives.map((c) => {
        const FormatIcon = FORMAT_ICONS[c.format ?? 'image'] ?? ImageIcon;
        return (
          <Card
            key={c.id}
            onClick={() => onClick(c)}
            className="border-zinc-800 cursor-pointer hover:bg-muted/30 hover:border-zinc-700 transition-all duration-200 overflow-hidden"
          >
            {/* Thumbnail */}
            <div className="h-40 bg-zinc-900 flex items-center justify-center relative">
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt={c.ad_name} className="w-full h-full object-cover" />
              ) : (
                <FormatIcon className="w-12 h-12 text-zinc-700" />
              )}
              <div className="absolute top-2 left-2 flex gap-1">
                <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">{c.status}</Badge>
                <Badge variant="outline" className="text-[10px]">
                  <FormatIcon className="w-3 h-3 mr-0.5" />{c.format}
                </Badge>
              </div>
              {c.quality_ranking && (
                <div className="absolute top-2 right-2">
                  {rankingBadge(c.quality_ranking)}
                </div>
              )}
            </div>

            <CardContent className="p-3 space-y-2">
              <p className="text-sm font-medium text-zinc-200 truncate">{c.ad_name}</p>
              {c.title && <p className="text-xs text-zinc-400 truncate">{c.title}</p>}
              {c.body && <p className="text-xs text-zinc-500 line-clamp-2">{c.body}</p>}

              {/* Performance metrics */}
              <div className="grid grid-cols-4 gap-1 pt-2 border-t border-zinc-800">
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">Spend</p>
                  <p className="text-xs text-zinc-300 font-medium">{c.spend.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">Conv</p>
                  <p className="text-xs text-zinc-300 font-medium">{c.conversions}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">CPA</p>
                  <p className={`text-xs font-medium ${metricColor('cpa', c.cpa)}`}>{c.cpa.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">ROAS</p>
                  <p className={`text-xs font-medium ${metricColor('roas', c.roas)}`}>{c.roas.toFixed(1)}x</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CREATIVE LIST VIEW
// ═══════════════════════════════════════════════════════════

function CreativeList({ creatives, onClick }: { creatives: Creative[]; onClick: (c: Creative) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60">
            <TableHead className="text-xs">Creative</TableHead>
            <TableHead className="text-xs">Campaign</TableHead>
            <TableHead className="text-xs">Format</TableHead>
            <TableHead className="text-xs">Headline</TableHead>
            <TableHead className="text-xs">Spend</TableHead>
            <TableHead className="text-xs">Conv</TableHead>
            <TableHead className="text-xs">CPA</TableHead>
            <TableHead className="text-xs">ROAS</TableHead>
            <TableHead className="text-xs">CTR</TableHead>
            <TableHead className="text-xs">Quality</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creatives.map((c) => (
            <TableRow
              key={c.id}
              onClick={() => onClick(c)}
              className="cursor-pointer hover:bg-muted/30 transition-colors duration-200"
            >
              <TableCell className="text-xs text-zinc-200 font-medium">
                <div className="flex items-center gap-2">
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-zinc-600" />
                    </div>
                  )}
                  <span className="truncate max-w-[150px]">{c.ad_name}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs text-zinc-400 truncate max-w-[120px]">{c.campaign_name}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{c.format}</Badge></TableCell>
              <TableCell className="text-xs text-zinc-400 truncate max-w-[150px]">{c.title ?? '—'}</TableCell>
              <TableCell className="text-xs text-zinc-300">{c.spend.toLocaleString()} AED</TableCell>
              <TableCell className="text-xs text-zinc-300 font-medium">{c.conversions}</TableCell>
              <TableCell className={`text-xs font-medium ${metricColor('cpa', c.cpa)}`}>{c.cpa.toFixed(0)} AED</TableCell>
              <TableCell className={`text-xs font-medium ${metricColor('roas', c.roas)}`}>{c.roas.toFixed(1)}x</TableCell>
              <TableCell className={`text-xs font-medium ${metricColor('ctr', c.ctr)}`}>{(c.ctr * 100).toFixed(2)}%</TableCell>
              <TableCell>{rankingBadge(c.quality_ranking)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CREATIVE DETAIL
// ═══════════════════════════════════════════════════════════

function CreativeDetail({ creative: c }: { creative: Creative }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-zinc-100 flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-400" /> {c.ad_name}
        </DialogTitle>
      </DialogHeader>

      {/* Thumbnail */}
      <div className="h-48 bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden">
        {c.thumbnail_url ? (
          <img src={c.thumbnail_url} alt={c.ad_name} className="w-full h-full object-contain" />
        ) : (
          <ImageIcon className="w-16 h-16 text-zinc-700" />
        )}
      </div>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'}>{c.status}</Badge>
        <Badge variant="outline">{c.format}</Badge>
        {rankingBadge(c.quality_ranking)}
        {rankingBadge(c.engagement_rate_ranking)}
        {rankingBadge(c.conversion_rate_ranking)}
      </div>

      {/* Copy Content */}
      <div className="space-y-3">
        {c.title && (
          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Headline</span>
              <button onClick={() => copyToClipboard(c.title!)} className="cursor-pointer hover:text-zinc-200 transition-colors">
                <Copy className="w-3 h-3 text-zinc-500" />
              </button>
            </div>
            <p className="text-sm text-zinc-200 font-medium">{c.title}</p>
          </div>
        )}
        {c.body && (
          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Body Copy</span>
              <button onClick={() => copyToClipboard(c.body!)} className="cursor-pointer hover:text-zinc-200 transition-colors">
                <Copy className="w-3 h-3 text-zinc-500" />
              </button>
            </div>
            <p className="text-sm text-zinc-300">{c.body}</p>
          </div>
        )}
        {c.description && (
          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Description</span>
              <button onClick={() => copyToClipboard(c.description!)} className="cursor-pointer hover:text-zinc-200 transition-colors">
                <Copy className="w-3 h-3 text-zinc-500" />
              </button>
            </div>
            <p className="text-sm text-zinc-300">{c.description}</p>
          </div>
        )}
        {c.link_url && (
          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Landing Page</span>
            <a href={c.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 cursor-pointer mt-0.5">
              {c.link_url} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        {c.cta_type && (
          <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">CTA</span>
            <p className="text-sm text-zinc-200 font-medium mt-0.5">{c.cta_type}</p>
          </div>
        )}
      </div>

      {/* Performance */}
      <Card className="border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-200">Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Spend', value: `${c.spend.toLocaleString()} AED` },
              { label: 'Impressions', value: c.impressions.toLocaleString() },
              { label: 'Clicks', value: c.clicks.toLocaleString() },
              { label: 'Conversions', value: c.conversions.toLocaleString() },
              { label: 'CTR', value: `${(c.ctr * 100).toFixed(2)}%`, color: metricColor('ctr', c.ctr) },
              { label: 'CPC', value: `${c.cpc.toFixed(0)} AED` },
              { label: 'CPA', value: `${c.cpa.toFixed(0)} AED`, color: metricColor('cpa', c.cpa) },
              { label: 'ROAS', value: `${c.roas.toFixed(2)}x`, color: metricColor('roas', c.roas) },
            ].map(m => (
              <div key={m.label} className="text-center p-2 bg-zinc-900/50 rounded-lg">
                <p className="text-[10px] text-zinc-500">{m.label}</p>
                <p className={`text-sm font-medium ${m.color ?? 'text-zinc-200'}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// UPLOAD FORM
// ═══════════════════════════════════════════════════════════

function UploadForm({ onUpload }: { onUpload: (asset: UploadedAsset) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'image' | 'video'>('image');
  const [fileSize, setFileSize] = useState(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    setFileType(file.type.startsWith('video') ? 'video' : 'image');

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!preview || !fileName) return;
    onUpload({
      id: `asset_${Date.now()}`,
      name: fileName,
      type: fileType,
      url: preview,
      size: fileSize,
      uploadedAt: new Date(),
    });
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-500 hover:bg-muted/20 transition-all duration-200"
      >
        {preview ? (
          fileType === 'image' ? (
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
          ) : (
            <video src={preview} className="max-h-48 mx-auto rounded" controls />
          )
        ) : (
          <>
            <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Click or drag to upload image/video</p>
            <p className="text-xs text-zinc-600 mt-1">PNG, JPG, MP4, MOV up to 30MB</p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />

      {fileName && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">{fileName}</span>
          <span className="text-zinc-500">{(fileSize / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!preview}
        className="w-full gap-1.5 cursor-pointer"
      >
        <Upload className="w-3.5 h-3.5" /> Upload Asset
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ASSET LIBRARY
// ═══════════════════════════════════════════════════════════

function AssetLibrary({ assets, onAssetsChange }: { assets: UploadedAsset[]; onAssetsChange: (a: UploadedAsset[]) => void }) {
  const handleDelete = (id: string) => {
    onAssetsChange(assets.filter(a => a.id !== id));
  };

  const handleDownload = (asset: UploadedAsset) => {
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = asset.name;
    a.click();
  };

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-zinc-500">
        <ImageIcon className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
        <p>No uploaded assets yet.</p>
        <p className="text-xs mt-1">Use the Upload button to add images and videos.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {assets.map((asset) => (
        <Card key={asset.id} className="border-zinc-800 overflow-hidden">
          <div className="h-32 bg-zinc-900 flex items-center justify-center">
            {asset.type === 'image' ? (
              <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <video src={asset.url} className="w-full h-full object-cover" />
            )}
          </div>
          <CardContent className="p-2 space-y-1.5">
            <p className="text-xs text-zinc-200 font-medium truncate">{asset.name}</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">{(asset.size / 1024 / 1024).toFixed(1)} MB</span>
              <div className="flex gap-1">
                <button onClick={() => handleDownload(asset)} className="p-1 rounded cursor-pointer hover:bg-muted/30 transition-colors">
                  <Download className="w-3 h-3 text-zinc-400" />
                </button>
                <button onClick={() => handleDelete(asset.id)} className="p-1 rounded cursor-pointer hover:bg-red-500/20 transition-colors">
                  <X className="w-3 h-3 text-zinc-400 hover:text-red-400" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COPY LIBRARY
// ═══════════════════════════════════════════════════════════

function CopyLibrary({
  variants,
  onVariantsChange,
  onExport,
}: {
  variants: CopyVariant[];
  onVariantsChange: (v: CopyVariant[]) => void;
  onExport: () => void;
}) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDelete = (id: string) => {
    onVariantsChange(variants.filter(v => v.id !== id));
  };

  const handleStatusChange = (id: string, status: CopyVariant['status']) => {
    onVariantsChange(variants.map(v => v.id === id ? { ...v, status } : v));
  };

  if (variants.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-zinc-500">
        <FileText className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
        <p>No copy variants yet.</p>
        <p className="text-xs mt-1">Use the Copy Editor to create headlines and body text.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>
      <div className="space-y-2">
        {variants.map((v) => (
          <Card key={v.id} className="border-zinc-800">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{v.headline}</p>
                    <Badge
                      variant={v.status === 'active' ? 'default' : v.status === 'draft' ? 'secondary' : 'outline'}
                      className="text-[10px]"
                    >
                      {v.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400">{v.body}</p>
                  {v.description && <p className="text-xs text-zinc-500">{v.description}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px]">CTA: {v.cta}</Badge>
                    <span className="text-[10px] text-zinc-600">{new Date(v.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-1 ml-3">
                  <button onClick={() => copyToClipboard(`${v.headline}\n\n${v.body}`)} className="p-1.5 rounded cursor-pointer hover:bg-muted/30 transition-colors" title="Copy all text">
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  {v.status === 'draft' && (
                    <button onClick={() => handleStatusChange(v.id, 'active')} className="p-1.5 rounded cursor-pointer hover:bg-emerald-500/20 transition-colors" title="Mark active">
                      <Check className="w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400" />
                    </button>
                  )}
                  {v.status === 'active' && (
                    <button onClick={() => handleStatusChange(v.id, 'archived')} className="p-1.5 rounded cursor-pointer hover:bg-amber-500/20 transition-colors" title="Archive">
                      <AlertTriangle className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-400" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded cursor-pointer hover:bg-red-500/20 transition-colors" title="Delete">
                    <X className="w-3.5 h-3.5 text-zinc-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COPY EDITOR
// ═══════════════════════════════════════════════════════════

function CopyEditor({ onSave }: { onSave: (variant: CopyVariant) => void }) {
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [description, setDescription] = useState('');
  const [cta, setCta] = useState('Learn More');

  const CTA_OPTIONS = ['Learn More', 'Sign Up', 'Book Now', 'Get Offer', 'Contact Us', 'Shop Now', 'Send Message', 'Apply Now', 'Get Quote', 'Subscribe'];

  const handleSave = () => {
    if (!headline.trim() || !body.trim()) return;
    onSave({
      id: `copy_${Date.now()}`,
      headline: headline.trim(),
      body: body.trim(),
      description: description.trim() || undefined,
      cta,
      status: 'draft',
      createdAt: new Date(),
    });
    setHeadline('');
    setBody('');
    setDescription('');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Headline *</label>
        <Input
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          placeholder="e.g., Transform Your Body in 90 Days"
          maxLength={40}
          className="bg-zinc-900 border-zinc-800"
        />
        <p className="text-[10px] text-zinc-600 mt-0.5">{headline.length}/40 characters</p>
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Body Copy *</label>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Main ad text..."
          maxLength={125}
          rows={3}
          className="bg-zinc-900 border-zinc-800 resize-none"
        />
        <p className="text-[10px] text-zinc-600 mt-0.5">{body.length}/125 characters</p>
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Description (optional)</label>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Additional description text"
          maxLength={30}
          className="bg-zinc-900 border-zinc-800"
        />
        <p className="text-[10px] text-zinc-600 mt-0.5">{description.length}/30 characters</p>
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">CTA Button</label>
        <div className="flex flex-wrap gap-1.5">
          {CTA_OPTIONS.map(option => (
            <button
              key={option}
              onClick={() => setCta(option)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors duration-200 cursor-pointer border ${
                cta === option
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'text-zinc-400 border-zinc-800 hover:bg-muted/30'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {(headline || body) && (
        <Card className="border-zinc-700 bg-zinc-900/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-zinc-500 mb-1">PREVIEW</p>
            {headline && <p className="text-sm font-semibold text-zinc-100">{headline}</p>}
            {body && <p className="text-xs text-zinc-300 mt-1">{body}</p>}
            {description && <p className="text-xs text-zinc-400 mt-0.5">{description}</p>}
            <div className="mt-2">
              <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded">{cta}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleSave}
        disabled={!headline.trim() || !body.trim()}
        className="w-full gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Save Copy Variant
      </Button>
    </div>
  );
}
