import { useState, useCallback } from 'react';
import { useMetaAds } from '@/hooks/useMetaAds';
import MetaAdsChat from '@/components/meta-ads/MetaAdsChat';
import MetaAdsDashboard from '@/components/meta-ads/MetaAdsDashboard';
import MetaAdsCreatives from '@/components/meta-ads/MetaAdsCreatives';
import MetaAdsAudience from '@/components/meta-ads/MetaAdsAudience';
import MetaAdsAttribution from '@/components/meta-ads/MetaAdsAttribution';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, MessageSquare, Users, Settings, Sparkles, Link2,
} from 'lucide-react';
import type { BrandFilter, TimeRange } from '@/types/metaAds';

export default function MetaAdsPage() {
  const [dailyBudget, setDailyBudget] = useState(10);
  const [defaultBrand, setDefaultBrand] = useState<BrandFilter>('all');
  const [defaultTimeRange, setDefaultTimeRange] = useState<TimeRange>('last_7d');

  const { dashboard, loadDashboard } = useMetaAds({ dailyBudget, defaultAccountId: 'act_349832333681399' });

  const loadCreatives = useCallback(() => {
    loadDashboard(defaultTimeRange, ['creatives']);
  }, [loadDashboard, defaultTimeRange]);

  const loadAudience = useCallback(() => {
    loadDashboard(defaultTimeRange, ['audience']);
  }, [loadDashboard, defaultTimeRange]);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-100">
          <span className="text-blue-400">PTD</span> Meta Ads Intelligence
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Qwen + Anthropic MCP • Dual AI Pipeline</p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200" onClick={loadCreatives}>
            <Sparkles className="w-3.5 h-3.5" /> Creatives
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <MessageSquare className="w-3.5 h-3.5" /> AI Chat
          </TabsTrigger>
          <TabsTrigger value="audience" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200" onClick={loadAudience}>
            <Users className="w-3.5 h-3.5" /> Audience
          </TabsTrigger>
          <TabsTrigger value="attribution" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Link2 className="w-3.5 h-3.5" /> Attribution
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors duration-200">
            <Settings className="w-3.5 h-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <MetaAdsDashboard />
        </TabsContent>

        <TabsContent value="creatives">
          <MetaAdsCreatives
            topCreatives={dashboard.topCreatives}
            isLoading={dashboard.isLoading}
            onRefresh={loadCreatives}
          />
        </TabsContent>

        <TabsContent value="chat" className="h-[calc(100vh-12rem)]">
          <MetaAdsChat />
        </TabsContent>

        <TabsContent value="audience">
          <MetaAdsAudience
            audience={dashboard.audience}
            isLoading={dashboard.isLoading}
            onRefresh={loadAudience}
          />
        </TabsContent>

        <TabsContent value="attribution">
          <MetaAdsAttribution />
        </TabsContent>

        <TabsContent value="settings">
          <div className="max-w-lg space-y-6">
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-200">Daily Token Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Max daily AI spend</span>
                  <Badge variant="outline" className="text-xs">${dailyBudget.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[dailyBudget]}
                  onValueChange={([v]) => setDailyBudget(v ?? 10)}
                  min={1}
                  max={50}
                  step={1}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>$1</span><span>$50</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-200">Default Brand Filter</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {([
                    { label: 'All Brands', value: 'all' as BrandFilter },
                    { label: 'PTD Fitness', value: 'ptd_fitness' as BrandFilter },
                    { label: 'PT Dubai', value: 'personal_trainers_dubai' as BrandFilter },
                  ]).map((b) => (
                    <button
                      key={b.value}
                      onClick={() => setDefaultBrand(b.value)}
                      className={`px-3 py-1.5 rounded-md text-xs transition-colors duration-200 cursor-pointer border ${
                        defaultBrand === b.value
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'text-zinc-400 border-zinc-800 hover:bg-muted/30'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-200">Default Time Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { label: 'Today', value: 'today' as TimeRange },
                    { label: '7 Days', value: 'last_7d' as TimeRange },
                    { label: '14 Days', value: 'last_14d' as TimeRange },
                    { label: '30 Days', value: 'last_30d' as TimeRange },
                    { label: 'This Month', value: 'this_month' as TimeRange },
                  ]).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setDefaultTimeRange(t.value)}
                      className={`px-3 py-1.5 rounded-md text-xs transition-colors duration-200 cursor-pointer border ${
                        defaultTimeRange === t.value
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'text-zinc-400 border-zinc-800 hover:bg-muted/30'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
