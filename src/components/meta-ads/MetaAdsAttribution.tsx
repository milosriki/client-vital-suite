// ═══════════════════════════════════════════════════════════
// Meta Ads Attribution Flow — Ad → Lead → Deal → Revenue
// Full information flow tracking across the ecosystem
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ArrowRight, Download, RefreshCw, Search, Target, Users, DollarSign,
  TrendingUp, Eye, ChevronRight, Zap, BarChart3, Link2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

interface CampaignAttribution {
  campaign_id: string;
  total_contacts: number;
  leads: number;
  opportunities: number;
  customers: number;
  total_deal_value: number;
  conversion_rate: number; // lead → customer %
}

interface AttributedContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  lifecycle_stage: string;
  attributed_campaign_id: string;
  attributed_ad_id: string;
  attributed_adset_id: string;
  attribution_source: string;
  first_touch_source: string;
  closed_deal_value: number;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────

function downloadCSV(headers: string[], rows: (string | number | undefined | null)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function stageColor(stage: string): string {
  switch (stage) {
    case 'customer': return 'text-emerald-400';
    case 'opportunity': return 'text-blue-400';
    case 'lead': return 'text-amber-400';
    default: return 'text-zinc-400';
  }
}

function stageBadge(stage: string) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    customer: 'default',
    opportunity: 'secondary',
    lead: 'outline',
  };
  return <Badge variant={variants[stage] ?? 'outline'} className="text-[10px]">{stage}</Badge>;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function MetaAdsAttribution() {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<AttributedContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [detailContact, setDetailContact] = useState<AttributedContact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id,first_name,last_name,email,phone,lifecycle_stage,attributed_campaign_id,attributed_ad_id,attributed_adset_id,attribution_source,first_touch_source,closed_deal_value,created_at')
        .not('attributed_campaign_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (!error && data) {
        setContacts(data as unknown as AttributedContact[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Computed: Campaign-level attribution ───────────────
  const campaignStats = useMemo(() => {
    const map = new Map<string, CampaignAttribution>();
    for (const c of contacts) {
      const cid = c.attributed_campaign_id || 'unknown';
      const existing = map.get(cid) || {
        campaign_id: cid,
        total_contacts: 0,
        leads: 0,
        opportunities: 0,
        customers: 0,
        total_deal_value: 0,
        conversion_rate: 0,
      };
      existing.total_contacts++;
      if (c.lifecycle_stage === 'lead') existing.leads++;
      if (c.lifecycle_stage === 'opportunity') existing.opportunities++;
      if (c.lifecycle_stage === 'customer') existing.customers++;
      existing.total_deal_value += Number(c.closed_deal_value ?? 0);
      map.set(cid, existing);
    }
    // Calc conversion rates
    for (const [, stats] of map) {
      stats.conversion_rate = stats.total_contacts > 0
        ? (stats.customers / stats.total_contacts) * 100
        : 0;
    }
    return Array.from(map.values()).sort((a, b) => b.total_deal_value - a.total_deal_value);
  }, [contacts]);

  // ─── Filtered contacts ─────────────────────────────────
  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    if (selectedCampaign) {
      filtered = filtered.filter(c => c.attributed_campaign_id === selectedCampaign);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.first_name ?? '').toLowerCase().includes(q) ||
        (c.last_name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      );
    }
    return filtered;
  }, [contacts, selectedCampaign, searchQuery]);

  // ─── Summary stats ─────────────────────────────────────
  const summary = useMemo(() => ({
    totalAttributed: contacts.length,
    totalLeads: contacts.filter(c => c.lifecycle_stage === 'lead').length,
    totalOpps: contacts.filter(c => c.lifecycle_stage === 'opportunity').length,
    totalCustomers: contacts.filter(c => c.lifecycle_stage === 'customer').length,
    totalRevenue: contacts.reduce((s, c) => s + Number(c.closed_deal_value ?? 0), 0),
    uniqueCampaigns: new Set(contacts.map(c => c.attributed_campaign_id)).size,
  }), [contacts]);

  // ─── Flow visualization data ────────────────────────────
  const flowStages = [
    { label: 'Meta Ad Click', count: summary.totalAttributed, icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Lead Created', count: summary.totalLeads, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Opportunity', count: summary.totalOpps, icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Customer', count: summary.totalCustomers, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Revenue', count: summary.totalRevenue, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10', isCurrency: true },
  ];

  const exportCampaigns = () => {
    const headers = ['Campaign ID', 'Total Contacts', 'Leads', 'Opportunities', 'Customers', 'Deal Value (AED)', 'Conversion %'];
    const rows = campaignStats.map(s => [s.campaign_id, s.total_contacts, s.leads, s.opportunities, s.customers, s.total_deal_value, s.conversion_rate.toFixed(1)]);
    downloadCSV(headers, rows, 'meta-attribution-campaigns');
  };

  const exportContacts = () => {
    const headers = ['Name', 'Email', 'Phone', 'Stage', 'Campaign ID', 'Ad ID', 'Source', 'Deal Value', 'Created'];
    const rows = filteredContacts.map(c => [
      `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(), c.email, c.phone, c.lifecycle_stage,
      c.attributed_campaign_id, c.attributed_ad_id, c.attribution_source, c.closed_deal_value,
      c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
    ]);
    downloadCSV(headers, rows, 'meta-attributed-contacts');
  };

  return (
    <div className="space-y-4">
      {/* ─── Header ──────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-400" />
            Attribution Flow
          </h2>
          <p className="text-xs text-zinc-500">
            {summary.totalAttributed.toLocaleString()} contacts tracked from Meta Ads • {summary.uniqueCampaigns} campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCampaigns} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Download className="w-3.5 h-3.5" /> Campaigns CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportContacts} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Download className="w-3.5 h-3.5" /> Contacts CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ─── Flow Visualization ──────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {flowStages.map((stage, i) => (
          <div key={stage.label} className="flex items-center">
            <Card className={`border-zinc-800 ${stage.bg} min-w-[140px]`}>
              <CardContent className="p-3 text-center">
                <stage.icon className={`w-5 h-5 mx-auto mb-1.5 ${stage.color}`} />
                <p className={`text-lg font-bold ${stage.color}`}>
                  {'isCurrency' in stage && stage.isCurrency
                    ? `${(stage.count as number).toLocaleString()} AED`
                    : (stage.count as number).toLocaleString()
                  }
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{stage.label}</p>
                {i > 0 && i < flowStages.length - 1 && (
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {flowStages[i - 1].count > 0
                      ? `${((stage.count / flowStages[i - 1].count) * 100).toFixed(1)}% conv`
                      : '—'}
                  </p>
                )}
              </CardContent>
            </Card>
            {i < flowStages.length - 1 && (
              <ArrowRight className="w-4 h-4 text-zinc-700 mx-1 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* ─── Campaign Attribution Table ──────────── */}
      <Card className="border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Campaign Attribution
            {selectedCampaign && (
              <button
                onClick={() => setSelectedCampaign(null)}
                className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer ml-2"
              >
                Clear filter
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60">
                  <TableHead className="text-xs">Campaign ID</TableHead>
                  <TableHead className="text-xs">Contacts</TableHead>
                  <TableHead className="text-xs">Leads</TableHead>
                  <TableHead className="text-xs">Opps</TableHead>
                  <TableHead className="text-xs">Customers</TableHead>
                  <TableHead className="text-xs">Revenue (AED)</TableHead>
                  <TableHead className="text-xs">Conv %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignStats.slice(0, 20).map((s) => {
                  const isSelected = selectedCampaign === s.campaign_id;
                  return (
                    <TableRow
                      key={s.campaign_id}
                      onClick={() => setSelectedCampaign(isSelected ? null : s.campaign_id)}
                      className={`cursor-pointer hover:bg-muted/30 transition-colors duration-200 ${isSelected ? 'bg-blue-500/10' : ''}`}
                    >
                      <TableCell className="text-xs text-zinc-200 font-mono">
                        <span className="flex items-center gap-1">
                          {s.campaign_id.slice(0, 12)}…
                          <ChevronRight className="w-3 h-3 text-zinc-600" />
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300 font-medium">{s.total_contacts}</TableCell>
                      <TableCell className="text-xs text-amber-400">{s.leads}</TableCell>
                      <TableCell className="text-xs text-blue-400">{s.opportunities}</TableCell>
                      <TableCell className="text-xs text-emerald-400 font-medium">{s.customers}</TableCell>
                      <TableCell className="text-xs text-green-400 font-medium">{s.total_deal_value.toLocaleString()}</TableCell>
                      <TableCell className={`text-xs font-medium ${s.conversion_rate >= 10 ? 'text-emerald-400' : s.conversion_rate >= 5 ? 'text-amber-400' : 'text-red-400'}`}>
                        {s.conversion_rate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Contact-Level Attribution ────────────── */}
      <Card className="border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Attributed Contacts ({filteredContacts.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, phone..."
                className="pl-9 h-8 text-xs bg-zinc-900 border-zinc-800"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-zinc-800 max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-900/60 hover:bg-zinc-900/60 sticky top-0">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Source</TableHead>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs">Ad</TableHead>
                  <TableHead className="text-xs">Deal Value</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.slice(0, 100).map((c) => (
                  <TableRow
                    key={c.id}
                    onClick={() => { setDetailContact(c); setDetailOpen(true); }}
                    className="cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                  >
                    <TableCell className="text-xs text-zinc-200 font-medium">
                      {`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || '—'}
                    </TableCell>
                    <TableCell>{stageBadge(c.lifecycle_stage ?? 'unknown')}</TableCell>
                    <TableCell className="text-xs text-zinc-400">{c.attribution_source ?? c.first_touch_source ?? '—'}</TableCell>
                    <TableCell className="text-xs text-zinc-400 font-mono">{c.attributed_campaign_id?.slice(0, 10) ?? '—'}…</TableCell>
                    <TableCell className="text-xs text-zinc-400 font-mono">{c.attributed_ad_id?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className={`text-xs font-medium ${Number(c.closed_deal_value ?? 0) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                      {Number(c.closed_deal_value ?? 0) > 0 ? `${Number(c.closed_deal_value).toLocaleString()} AED` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredContacts.length > 100 && (
            <p className="text-xs text-zinc-500 mt-2 text-center">Showing 100 of {filteredContacts.length} contacts</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Contact Detail Dialog ────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {detailContact && (
            <>
              <DialogHeader>
                <DialogTitle className="text-zinc-100">
                  {`${detailContact.first_name ?? ''} ${detailContact.last_name ?? ''}`.trim() || 'Contact Details'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {[
                  { label: 'Email', value: detailContact.email },
                  { label: 'Phone', value: detailContact.phone },
                  { label: 'Lifecycle Stage', value: detailContact.lifecycle_stage, badge: true },
                  { label: 'Attribution Source', value: detailContact.attribution_source },
                  { label: 'First Touch', value: detailContact.first_touch_source },
                  { label: 'Campaign ID', value: detailContact.attributed_campaign_id, mono: true },
                  { label: 'Ad Set ID', value: detailContact.attributed_adset_id, mono: true },
                  { label: 'Ad ID', value: detailContact.attributed_ad_id, mono: true },
                  { label: 'Deal Value', value: Number(detailContact.closed_deal_value ?? 0) > 0 ? `${Number(detailContact.closed_deal_value).toLocaleString()} AED` : null },
                  { label: 'Created', value: detailContact.created_at ? new Date(detailContact.created_at).toLocaleDateString() : null },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                    <span className="text-xs text-zinc-500">{f.label}</span>
                    {'badge' in f && f.badge
                      ? stageBadge(f.value as string)
                      : <span className={`text-xs text-zinc-200 ${'mono' in f && f.mono ? 'font-mono' : ''}`}>{f.value}</span>
                    }
                  </div>
                ))}

                {/* Flow visualization for this contact */}
                <div className="pt-3 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-2">Attribution Journey</p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">Meta Ad</Badge>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <Badge variant="outline" className="text-[10px]">Click</Badge>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    {stageBadge(detailContact.lifecycle_stage ?? 'unknown')}
                    {Number(detailContact.closed_deal_value ?? 0) > 0 && (
                      <>
                        <ArrowRight className="w-3 h-3 text-zinc-600" />
                        <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/20">
                          {Number(detailContact.closed_deal_value).toLocaleString()} AED
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
