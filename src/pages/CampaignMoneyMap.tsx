import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Target, Users, Zap, ArrowRight, Wallet } from 'lucide-react';
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function CampaignMoneyMap() {
  // Fetch real-time business metrics from daily_business_metrics table
  const { data: dailyMetrics } = useDedupedQuery({
    queryKey: ['daily-business-metrics-moneymap'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_business_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const { data: campaignData, isLoading } = useDedupedQuery({
    queryKey: ['campaign-money-map'],
    queryFn: async () => {
      // 1. Fetch Facebook Spend per Campaign - using real-time data
      const { data: fbData, error: fbError } = await supabase
        .from('facebook_ads_insights')
        .select('campaign_name, spend, impressions, clicks')
        .gte('date', format(subDays(new Date(), 30), 'yyyy-MM-dd'));

      if (fbError) throw fbError;

      // 2. Fetch HubSpot Leads/Revenue per Campaign - using real-time deal values
      const { data: hubspotData, error: hsError } = await supabase
        .from('contacts')
        .select('utm_campaign, total_deal_value, closed_deal_value, num_associated_deals')
        .not('utm_campaign', 'is', null);

      if (hsError) throw hsError;

      // 3. Fetch real-time deal revenue data
      const { data: dealsData } = await supabase
        .from('deals')
        .select('deal_value, cash_collected, status')
        .eq('status', 'closed')
        .gte('close_date', format(subDays(new Date(), 30), 'yyyy-MM-dd'));

      // 4. Join and Aggregate
      const map: Record<string, any> = {};

      // Aggregate FB Spend with additional metrics
      fbData?.forEach((row: any) => {
        if (!map[row.campaign_name]) {
          map[row.campaign_name] = { 
            name: row.campaign_name, 
            spend: 0, 
            revenue: 0, 
            leads: 0, 
            deals: 0,
            impressions: 0,
            clicks: 0
          };
        }
        map[row.campaign_name].spend += parseFloat(row.spend || 0);
        map[row.campaign_name].impressions += parseInt(row.impressions || 0);
        map[row.campaign_name].clicks += parseInt(row.clicks || 0);
      });

      // Aggregate HubSpot Results with real-time revenue
      hubspotData?.forEach((row: any) => {
        const campaign = row.utm_campaign;
        if (!map[campaign]) {
          map[campaign] = { 
            name: campaign, 
            spend: 0, 
            revenue: 0, 
            leads: 0, 
            deals: 0,
            impressions: 0,
            clicks: 0
          };
        }
        map[campaign].leads += 1;
        // Use closed_deal_value for actual revenue, fallback to total_deal_value
        map[campaign].revenue += parseFloat(row.closed_deal_value || row.total_deal_value || 0);
        map[campaign].deals += parseInt(row.num_associated_deals || 0);
      });

      return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }
  });

  const totals = useMemo(() => {
    return (campaignData || []).reduce((acc, curr) => ({
      spend: acc.spend + curr.spend,
      revenue: acc.revenue + curr.revenue,
      leads: acc.leads + curr.leads,
      deals: acc.deals + curr.deals
    }), { spend: 0, revenue: 0, leads: 0, deals: 0 });
  }, [campaignData]);

  const totalRoas = totals.spend > 0 ? (totals.revenue / totals.spend).toFixed(1) : "0.0";

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaign Money Map</h1>
          <p className="text-muted-foreground">ROI Analysis: Bridging Facebook Spend & HubSpot Revenue</p>
        </div>
              <div className="flex items-center gap-4">
                {dailyMetrics && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full border border-green-500/20">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-bold text-green-500">Daily ROAS: {(dailyMetrics.roas_daily || 0).toFixed(1)}x</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                  <Zap className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-sm font-bold text-primary">30-Day ROI: {totalRoas}x</span>
                </div>
              </div>
            </div>

            {/* Real-time Daily Metrics Banner */}
            {dailyMetrics && (
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-4 py-3 rounded-lg bg-gradient-to-r from-green-500/10 to-primary/10 border border-green-500/20 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Today's Ad Spend:</span>
                  <span className="font-semibold text-red-400">AED {(dailyMetrics.ad_spend_facebook || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Today's Revenue:</span>
                  <span className="font-semibold text-green-400">AED {(dailyMetrics.total_revenue_booked || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Cost Per Lead:</span>
                  <span className="font-semibold">AED {(dailyMetrics.cost_per_lead || 0).toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto text-xs text-muted-foreground">
                  <Zap className="h-3 w-3 text-primary" />
                  Real-time from daily_business_metrics
                </div>
              </div>
            )}

            {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroCard title="Total Ad Spend" value={`AED ${totals.spend.toLocaleString()}`} icon={Wallet} color="text-red-400" />
        <HeroCard title="Total Revenue" value={`AED ${totals.revenue.toLocaleString()}`} icon={DollarSign} color="text-green-400" />
        <HeroCard title="Total Leads" value={totals.leads} icon={Users} color="text-blue-400" />
        <HeroCard title="Total Deals" value={totals.deals} icon={Target} color="text-purple-400" />
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Campaign ROI Deep Dive</CardTitle>
          <CardDescription>Breakdown of profitability per marketing campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead className="text-right">Spend (AED)</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Revenue (AED)</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10">Calculating ROI...</TableCell></TableRow>
                ) : (campaignData || []).map((c: any) => {
                  const roas = c.spend > 0 ? (c.revenue / c.spend).toFixed(1) : "∞";
                  const isProfitable = parseFloat(roas) > 2 || roas === "∞";
                  
                  return (
                    <TableRow key={c.name} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium max-w-[250px] truncate">{c.name}</TableCell>
                      <TableCell className="text-right font-mono text-red-400">{c.spend.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{c.leads}</TableCell>
                      <TableCell className="text-right font-mono text-green-400">{c.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={isProfitable ? "success" : "destructive"} className="font-mono">
                          {roas}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isProfitable ? (
                          <div className="flex items-center justify-end text-success text-xs gap-1">
                            <TrendingUp className="h-3 w-3" /> Scale
                          </div>
                        ) : (
                          <div className="flex items-center justify-end text-destructive text-xs gap-1">
                            <ArrowRight className="h-3 w-3 rotate-45" /> Kill
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeroCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <div className="text-2xl font-bold font-mono">{value}</div>
      </CardContent>
    </Card>
  );
}
