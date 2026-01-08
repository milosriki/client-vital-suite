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
  const { data: campaignData, isLoading } = useDedupedQuery({
    queryKey: ['campaign-money-map-rpc'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_money_map', { days_back: 90 });
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        name: row.campaign_name,
        spend: Number(row.total_spend || 0),
        leads: Number(row.total_leads || 0),
        revenue: Number(row.total_revenue || 0),
        deals: Number(row.total_deals || 0)
      }));
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

  if (!isLoading && (!campaignData || campaignData.length === 0)) {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Campaign Money Map</h1>
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-4">
            <Target className="h-12 w-12 text-muted-foreground opacity-50" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No Campaign Data Found</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                We couldn't find any Facebook spend or attributed HubSpot revenue for the selected period. 
                Ensure your Facebook Ads sync is running and UTM parameters are correctly set.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaign Money Map</h1>
          <p className="text-muted-foreground">ROI Analysis: Bridging Facebook Spend & HubSpot Revenue</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
          <Zap className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-bold text-primary">Live ROI: {totalRoas}x</span>
        </div>
      </div>

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
