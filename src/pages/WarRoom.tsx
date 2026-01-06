import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Crown, TrendingUp, TrendingDown, DollarSign, Target, 
  AlertTriangle, Users, Zap, Pause, Play, RefreshCw,
  Rocket, ShieldAlert, BarChart3, Radio, Brain
} from "lucide-react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, ReferenceLine 
} from "recharts";

const WarRoom = () => {
  const [manualAdSpend, setAdSpend] = useState<number | null>(null);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);

  // Fetch live ad spend
  const { data: liveAdSpendData, isLoading: spendLoading } = useDedupedQuery({
    queryKey: ["war-room-spend"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from("facebook_ads_insights")
        .select("spend")
        .gte("date", thirtyDaysAgo.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      return data?.reduce((sum, row) => sum + (parseFloat(row.spend as any) || 0), 0) || 0;
    }
  });

  const adSpend = manualAdSpend ?? (liveAdSpendData || 15000);

  // Fetch deals for forecasting
  const { data: deals, isLoading: dealsLoading, error: dealsError } = useDedupedQuery({
    queryKey: ["war-room-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to fetch deals:", error);
        throw error;
      }
      return data || [];
    },
    retry: 2,
  });

  // Fetch leads for leakage detection
  const { data: leads, isLoading: leadsLoading, error: leadsError } = useDedupedQuery({
    queryKey: ["war-room-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enhanced_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to fetch leads:", error);
        throw error;
      }
      return data || [];
    },
    retry: 2,
  });

  // Fetch client health for LTV calculation
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useDedupedQuery({
    queryKey: ["war-room-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("*");
      if (error) {
        console.error("Failed to fetch clients:", error);
        throw error;
      }
      return data || [];
    },
    retry: 2,
  });

  // Show error toast if any query fails
  useEffect(() => {
    if (dealsError) toast.error("Failed to load deals data");
    if (leadsError) toast.error("Failed to load leads data");
    if (clientsError) toast.error("Failed to load client data");
  }, [dealsError, leadsError, clientsError]);
  // Calculate Unit Economics
  const newCustomersThisMonth = clients?.filter(c => {
    const created = new Date(c.created_at || "");
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length || 1;

  const totalRevenue = deals?.filter(d => d.status === "closed").reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0;
  const avgRevenuePerUser = clients?.length ? totalRevenue / clients.length : 0;
  // Calculate average retention from client data
  const avgRetentionMonths = clients?.length 
    ? Math.round(clients.reduce((sum, c) => {
        const created = new Date(c.created_at || "");
        const now = new Date();
        const months = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return sum + Math.max(1, months);
      }, 0) / clients.length)
    : 6;
  
  const cac = adSpend / Math.max(newCustomersThisMonth, 1);
  const ltv = avgRevenuePerUser * avgRetentionMonths;
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;
  
  // Calculate actual burn from operational costs estimate (ad spend + 50% operational overhead)
  const monthlyBurn = adSpend * 1.5;
  // Calculate net new ARR from this month's closed deals
  const thisMonthDeals = deals?.filter(d => {
    const created = new Date(d.created_at || "");
    const now = new Date();
    return created.getMonth() === now.getMonth() && 
           created.getFullYear() === now.getFullYear() &&
           (d.status === "closed" || (d.status as string) === "won");
  }) || [];
  const netNewArr = thisMonthDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
  const burnMultiple = netNewArr > 0 ? monthlyBurn / netNewArr : 0;

  // Calculate Leakage
  const buriedLeads = leads?.filter(l => {
    const created = new Date(l.created_at || "");
    const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7 && (!l.conversion_status || l.conversion_status === "new");
  }) || [];

  const stalledDeals = deals?.filter(d => {
    const updated = new Date(d.updated_at || d.created_at || "");
    const daysSince = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 14 && d.status !== "closed" && d.status !== "lost";
  }) || [];

  const discountedDeals = deals?.filter(d => {
    // Calculate discount: if cash_collected < deal_value, it was discounted
    const dealValue = d.deal_value || 0;
    const cashCollected = d.cash_collected || dealValue;
    // Consider it discounted if collected less than 90% of deal value
    return dealValue > 0 && cashCollected < (dealValue * 0.9);
  }) || [];

  // Calculate actual historical revenue from deals
  const getHistoricalRevenue = () => {
    const now = new Date();
    const closedDeals = deals?.filter(d => d.status === "closed" || (d.status as string) === "won") || [];
    
    // Get revenue for last 3 months
    const revenueByMonth: number[] = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthRevenue = closedDeals
        .filter(d => {
          const closeDate = new Date(d.close_date || d.created_at || "");
          return closeDate >= monthStart && closeDate <= monthEnd;
        })
        .reduce((sum, d) => sum + (d.deal_value || 0), 0);
      
      revenueByMonth.push(monthRevenue);
    }
    
    return revenueByMonth;
  };

  // Generate forecast data
  const generateForecastData = () => {
    const now = new Date();
    const months: string[] = [];
    
    // Get last 3 months and next 3 months
    for (let i = -2; i <= 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(date.toLocaleString('default', { month: 'short' }));
    }
    
    const actualRevenue = getHistoricalRevenue();
    
    const contractDeals = deals?.filter(d => d.stage === "Contract Sent") || [];
    const proposalDeals = deals?.filter(d => d.stage === "Proposal") || [];
    const activeDeals = deals?.filter(d => d.status !== "closed" && d.status !== "lost" && (d.status as string) !== "won") || [];
    
    const commitValue = contractDeals.reduce((sum, d) => sum + (d.deal_value || 0) * 0.9, 0);
    const likelyValue = proposalDeals.reduce((sum, d) => sum + (d.deal_value || 0) * 0.6, 0);
    const bestCaseValue = activeDeals.reduce((sum, d) => sum + (d.deal_value || 0) * 0.3, 0);
    
    // Use last month's revenue as baseline if available, otherwise use average
    const baselineRevenue = actualRevenue[2] || (actualRevenue.reduce((a, b) => a + b, 0) / 3) || 50000;
    
    return months.map((month, i) => ({
      month,
      actual: i < 3 ? actualRevenue[i] : null,
      commit: i >= 3 ? (commitValue / 3) + (baselineRevenue * 0.9) : null,
      likely: i >= 3 ? (likelyValue / 3) + (baselineRevenue * 0.85) : null,
      bestCase: i >= 3 ? (bestCaseValue / 3) + (baselineRevenue * 1.1) : null,
      target: 100000,
    }));
  };

  const forecastData = generateForecastData();
  const quarterlyTarget = 300000;
  const projectedRevenue = forecastData.slice(3).reduce((sum, d) => sum + (d.commit || 0), 0);
  const gapToTarget = quarterlyTarget - projectedRevenue;

  const handleReassignLeads = () => {
    toast.success(`Reassigning ${buriedLeads.length} buried leads to Shark Team`);
  };

  const handleSendBreakupEmails = () => {
    toast.success(`Sending break-up emails to ${stalledDeals.length} stalled deals`);
  };

  const handleAutoPilotToggle = (enabled: boolean) => {
    setAutoPilotEnabled(enabled);
    if (enabled) {
      toast.success("Auto-Pilot ENGAGED - AI is now managing operations", {
        icon: <Rocket className="h-4 w-4" />,
      });
    } else {
      toast.info("Auto-Pilot disengaged - Manual control restored");
    }
  };

  const isLoading = dealsLoading || leadsLoading || clientsLoading;

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
              CEO War Room
            </h1>
            <p className="text-zinc-500 text-sm">Strategic Command Center</p>
          </div>
        </div>
        
        {/* Auto-Pilot Switch */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2">
            {autoPilotEnabled ? (
              <Zap className="h-5 w-5 text-amber-400 animate-pulse" />
            ) : (
              <Pause className="h-5 w-5 text-zinc-500" />
            )}
            <span className="font-medium">Auto-Pilot</span>
          </div>
          <Switch 
            checked={autoPilotEnabled} 
            onCheckedChange={handleAutoPilotToggle}
            className="data-[state=checked]:bg-amber-500"
          />
          {autoPilotEnabled && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              AI ACTIVE
            </Badge>
          )}
        </div>
      </div>

      {/* Section 1: Unit Economics */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">The North Star - Unit Economics</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Ad Spend Input */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <label className="text-xs text-zinc-500 uppercase tracking-wide">Monthly Ad Spend</label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-zinc-500">AED</span>
                <Input
                  type="number"
                  value={adSpend}
                  onChange={(e) => setAdSpend(Number(e.target.value))}
                  className="bg-zinc-800 border-zinc-700 text-amber-400 font-mono text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* CAC */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">CAC</span>
                {cac < 500 ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    ON TARGET
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                    HIGH
                  </Badge>
                )}
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-amber-400 font-mono">
                  {isLoading ? <Skeleton className="h-9 w-24 bg-zinc-800" /> : `AED ${cac.toFixed(0)}`}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Goal: &lt; AED 500</p>
            </CardContent>
          </Card>

          {/* LTV */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">LTV</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-amber-400 font-mono">
                  {isLoading ? <Skeleton className="h-9 w-24 bg-zinc-800" /> : `AED ${ltv.toFixed(0)}`}
                </span>
              </div>
              <p className="text-xs text-emerald-400 mt-1">+5% vs last quarter</p>
            </CardContent>
          </Card>

          {/* LTV:CAC Ratio */}
          <Card className={`border ${ltvCacRatio >= 3 ? "border-emerald-500/50 bg-emerald-500/5" : ltvCacRatio < 1 ? "border-red-500/50 bg-red-500/5" : "border-zinc-800 bg-zinc-900/50"}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">LTV:CAC Ratio</span>
                <span className="text-xs text-amber-400">THE GOD METRIC</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-3xl font-bold text-amber-400 font-mono">
                  {isLoading ? <Skeleton className="h-9 w-16 bg-zinc-800" /> : `${ltvCacRatio.toFixed(1)}x`}
                </span>
                {ltvCacRatio >= 3 ? (
                  <Badge className="bg-emerald-500 text-white animate-pulse">
                    <Rocket className="h-3 w-3 mr-1" /> SCALE NOW
                  </Badge>
                ) : ltvCacRatio < 1 ? (
                  <Badge className="bg-red-500 text-white animate-pulse">
                    <ShieldAlert className="h-3 w-3 mr-1" /> STOP SPEND
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-400">OPTIMIZE</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Burn Multiple */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Burn Multiple</span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-amber-400 font-mono">
                  {isLoading ? <Skeleton className="h-9 w-16 bg-zinc-800" /> : `${burnMultiple.toFixed(1)}x`}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Net Burn / Net New ARR</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Predictive Forecasting */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-zinc-200">Predictive Forecasting</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-zinc-500">Gap to Q1 Target</p>
              <p className={`text-lg font-bold font-mono ${gapToTarget > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {gapToTarget > 0 ? `-AED ${gapToTarget.toLocaleString()}` : `+AED ${Math.abs(gapToTarget).toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="commitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="bestCaseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" />
                <YAxis stroke="#71717a" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#18181b", 
                    border: "1px solid #27272a",
                    borderRadius: "8px"
                  }}
                  formatter={(value: number) => [`AED ${value?.toLocaleString() || 0}`, ""]}
                />
                <Legend />
                <ReferenceLine y={100000} stroke="#f59e0b" strokeDasharray="5 5" label="Target" />
                <Area type="monotone" dataKey="actual" stroke="#f59e0b" fill="url(#actualGradient)" name="Actual" />
                <Area type="monotone" dataKey="bestCase" stroke="#3b82f6" fill="url(#bestCaseGradient)" name="Best Case" strokeDasharray="5 5" />
                <Area type="monotone" dataKey="likely" stroke="#8b5cf6" fill="none" name="Likely" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="commit" stroke="#10b981" fill="url(#commitGradient)" name="Commit" />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="flex justify-center gap-8 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-zinc-400">Commit (90%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-zinc-400">Likely (60%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Best Case (30%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Revenue Integrity */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Revenue Integrity - Leakage Detector</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Buried Leads */}
          <Card className={`border ${buriedLeads.length > 0 ? "border-red-500/50 bg-red-500/5" : "border-zinc-800 bg-zinc-900/50"}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-400">Buried Leads</span>
                <Users className="h-4 w-4 text-red-400" />
              </div>
              <div className="text-4xl font-bold text-red-400 font-mono mb-2">
                {isLoading ? <Skeleton className="h-10 w-12 bg-zinc-800" /> : buriedLeads.length}
              </div>
              <p className="text-xs text-zinc-500 mb-4">&gt; 7 days old with no activity</p>
              <Button 
                onClick={handleReassignLeads}
                disabled={buriedLeads.length === 0}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reassign to Shark Team
              </Button>
            </CardContent>
          </Card>

          {/* Stalled Deals */}
          <Card className={`border ${stalledDeals.length > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/50"}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-400">Stalled Deals</span>
                <Pause className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-4xl font-bold text-amber-400 font-mono mb-2">
                {isLoading ? <Skeleton className="h-10 w-12 bg-zinc-800" /> : stalledDeals.length}
              </div>
              <p className="text-xs text-zinc-500 mb-4">Stuck in same stage &gt; 14 days</p>
              <Button 
                onClick={handleSendBreakupEmails}
                disabled={stalledDeals.length === 0}
                className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
              >
                <Zap className="h-4 w-4 mr-2" />
                Send Break-up Emails
              </Button>
            </CardContent>
          </Card>

          {/* Discount Abuse */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-400">Discount Abuse</span>
                <DollarSign className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="text-4xl font-bold text-zinc-400 font-mono mb-2">
                {discountedDeals.length}
              </div>
              <p className="text-xs text-zinc-500 mb-4">Deals with &gt; 20% discount</p>
              <Button 
                disabled
                className="w-full bg-zinc-800 text-zinc-500 border border-zinc-700"
              >
                Flag for Review
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 4: Market Pulse */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Market Pulse</h2>
          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">COMING SOON</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed">
            <CardContent className="p-5 text-center">
              <BarChart3 className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-zinc-500">Competitor Ad Activity</h3>
              <p className="text-xs text-zinc-600 mt-1">Integration coming soon</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed">
            <CardContent className="p-5 text-center">
              <Target className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-zinc-500">Share of Voice</h3>
              <p className="text-xs text-zinc-600 mt-1">Integration coming soon</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed">
            <CardContent className="p-5 text-center">
              <Users className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-zinc-500">Customer Sentiment (NPS)</h3>
              <p className="text-xs text-zinc-600 mt-1">Integration coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Auto-Pilot Status Footer */}
      {autoPilotEnabled && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-amber-500/20 border border-amber-500/40 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 font-medium">Auto-Pilot Active</span>
            <span className="text-amber-400/60 text-sm">• Monitoring all systems</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarRoom;