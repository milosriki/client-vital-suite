import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Lightbulb, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface MetricDrilldownModalProps {
  open: boolean;
  onClose: () => void;
  metric: {
    title: string;
    value: string | number;
    type: "revenue" | "clients" | "pipeline" | "attention";
  } | null;
}

export const MetricDrilldownModal = ({ open, onClose, metric }: MetricDrilldownModalProps) => {
  if (!metric) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {metric.title} Analysis
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="contributors" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contributors">Top Contributors</TabsTrigger>
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="recommendations">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="contributors" className="mt-4">
            <ContributorsTab type={metric.type} />
          </TabsContent>

          <TabsContent value="trend" className="mt-4">
            <TrendTab type={metric.type} />
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <RecommendationsTab type={metric.type} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const ContributorsTab = ({ type }: { type: string }) => {
  const { data: contributors, isLoading } = useDedupedQuery({
    queryKey: QUERY_KEYS.metrics.contributors(type),
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      if (type === "revenue") {
        const { data } = await supabase
          .from("deals")
          .select("deal_name, deal_value, stage, created_at")
          .eq("status", "closed")
          .order("deal_value", { ascending: false })
          .limit(5);
        return data?.map((d) => ({
          name: d.deal_name || "Unnamed Deal",
          value: d.deal_value,
          change: 0,
          detail: d.stage,
        })) || [];
      } else if (type === "clients") {
        const { data } = await supabase
          .from("client_health_daily")
          .select("firstname, lastname, health_score, assigned_coach")
          .order("health_score", { ascending: false })
          .limit(5);
        return data?.map((c) => ({
          name: `${c.firstname || ""} ${c.lastname || ""}`.trim() || "Unknown",
          value: c.health_score,
          change: 0,
          detail: c.assigned_coach,
        })) || [];
      } else if (type === "pipeline") {
        const { data } = await supabase
          .from("deals")
          .select("deal_name, deal_value, stage")
          .neq("status", "closed")
          .neq("status", "lost")
          .order("deal_value", { ascending: false })
          .limit(5);
        return data?.map((d) => ({
          name: d.deal_name || "Unnamed Deal",
          value: d.deal_value,
          change: 0,
          detail: d.stage,
        })) || [];
      } else {
        const { data } = await supabase
          .from("client_health_daily")
          .select("firstname, lastname, health_score, churn_risk_score")
          .lt("health_score", 50)
          .order("health_score", { ascending: true })
          .limit(5);
        return data?.map((c) => ({
          name: `${c.firstname || ""} ${c.lastname || ""}`.trim() || "Unknown",
          value: c.health_score,
          change: -(c.churn_risk_score || 0),
          detail: `Churn Risk: ${c.churn_risk_score?.toFixed(0)}%`,
        })) || [];
      }
    },
  });

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contributors?.map((item, i) => (
        <Card key={i} className="bg-accent/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">
                  {typeof item.value === "number" 
                    ? type === "clients" || type === "attention"
                      ? `${item.value?.toFixed(0)}%`
                      : `AED ${item.value?.toLocaleString()}`
                    : item.value}
                </p>
                <div className={`flex items-center gap-1 text-xs ${(item.change ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {(item.change ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(item.change ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {(!contributors || contributors.length === 0) && (
        <p className="text-center text-muted-foreground py-8">No data available</p>
      )}
    </div>
  );
};

const TrendTab = ({ type }: { type: string }) => {
  const { data: trendData, isLoading } = useDedupedQuery({
    queryKey: QUERY_KEYS.metrics.trend(type),
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      // Generate last 30 days of data
      const days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return {
          date: format(date, "MMM dd"),
          value: 50000 + (i * 1000),
          previousValue: 45000 + (i * 900),
        };
      });
      return days;
    },
  });

  if (isLoading && !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const currentTotal = trendData?.slice(-7).reduce((sum, d) => sum + d.value, 0) || 0;
  const previousTotal = trendData?.slice(-14, -7).reduce((sum, d) => sum + d.value, 0) || 0;
  const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Last 7 days vs Previous 7 days</p>
          <p className="text-2xl font-bold">AED {currentTotal.toLocaleString()}</p>
        </div>
        <Badge className={change >= 0 ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}>
          {change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {Math.abs(change ?? 0).toFixed(1)}%
        </Badge>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={trendData}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--background))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px"
            }}
            formatter={(value: number) => [`AED ${value.toLocaleString()}`, "Value"]}
          />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#trendGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const RecommendationsTab = ({ type }: { type: string }) => {
  const { data: liveRecs } = useDedupedQuery({
    queryKey: [QUERY_KEYS.RECOMMENDATIONS, type],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_recommendations")
        .select("action, reasoning, confidence")
        .eq("status", "active")
        .order("confidence", { ascending: false })
        .limit(3);
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: healthAlerts } = useDedupedQuery({
    queryKey: [QUERY_KEYS.HEALTH_ALERTS, type],
    queryFn: async () => {
      if (type !== "clients" && type !== "attention") return [];
      const { data } = await supabase
        .from("client_health_daily")
        .select("client_name, total_score, tier, trend")
        .eq("tier", "RED")
        .order("total_score", { ascending: true })
        .limit(5);
      return data || [];
    },
    staleTime: 60_000,
  });

  const items: { icon: string; text: string }[] = [];

  if (type === "revenue" || type === "pipeline") {
    if (liveRecs?.length) {
      for (const r of liveRecs) {
        items.push({ icon: r.action === "SCALE" ? "🚀" : r.action === "KILL" ? "🛑" : "📊", text: `${r.action}: ${r.reasoning}` });
      }
    } else {
      items.push({ icon: "📊", text: "No active recommendations — check back after the next analytics run" });
    }
  } else if (type === "clients" || type === "attention") {
    if (healthAlerts?.length) {
      for (const a of healthAlerts) {
        items.push({ icon: a.trend === "crashing" ? "🚨" : "⚠️", text: `${a.client_name}: score ${a.total_score}/100 (${a.trend})` });
      }
    } else {
      items.push({ icon: "✅", text: "No critical health alerts right now" });
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <Card key={i} className="bg-accent/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{item.icon}</div>
              <div className="flex-1">
                <p className="text-sm">{item.text}</p>
              </div>
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
