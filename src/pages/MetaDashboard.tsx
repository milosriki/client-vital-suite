import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, DollarSign, MousePointer, Eye, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

// Use current origin by default to avoid localhost fallbacks in production.
const META_API_BASE =
  import.meta.env.VITE_META_CAPI_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export default function MetaDashboard() {
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch Facebook Ads Insights from Supabase
  const { data: insights, isLoading, refetch } = useDedupedQuery({
    queryKey: ['facebook-ads-insights', META_API_BASE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facebook_ads_insights' as any) // Type assertion until types are regenerated
        .select('*')
        .order('date', { ascending: false })
        .order('spend', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate aggregates
  const totals = (insights as any[] | undefined)?.reduce(
    (acc: { spend: number; impressions: number; clicks: number }, row: any) => ({
      spend: acc.spend + (Number(row.spend) || 0),
      impressions: acc.impressions + (Number(row.impressions) || 0),
      clicks: acc.clicks + (Number(row.clicks) || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0 }
  );

  const cpc = totals && totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const ctr = totals && totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-facebook-insights', {
        body: { date_preset: 'today' } // Or 'maximum' for historical
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to sync');
      }

      toast.success(`Synced ${data.count} ad insights from Facebook`);
      refetch();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Facebook Ads Performance</h1>
          <p className="text-muted-foreground">Live insights from your active campaigns</p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Live Data'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total Spend</span>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold">
              AED {(totals?.spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Impressions</span>
              <Eye className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">
              {(totals?.impressions || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Clicks</span>
              <MousePointer className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold">
              {(totals?.clicks || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">CTR / CPC</span>
              <Activity className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-2xl font-bold">{ctr.toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground">CTR</div>
              </div>
              <div className="h-10 w-px bg-border"></div>
              <div>
                <div className="text-2xl font-bold">AED {cpc.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">CPC</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ad Performance (Live)</CardTitle>
          <CardDescription>Breakdown by ad creative</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Ad Name</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">
                      Loading live insights...
                    </TableCell>
                  </TableRow>
                ) : insights && insights.length > 0 ? (
                  insights.map((row: any) => (
                    <TableRow key={`${row.date}-${row.ad_id}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(row.date), 'MMM d')}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={row.campaign_name}>
                        {row.campaign_name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={row.ad_name}>
                        {row.ad_name}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        AED {Number(row.spend).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(row.impressions).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(row.clicks).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(Number(row.ctr) || 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(Number(row.cpc) || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                      No data found. Click "Sync Live Data" to fetch from Facebook.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}