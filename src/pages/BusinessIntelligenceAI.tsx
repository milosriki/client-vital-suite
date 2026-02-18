import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Brain, Send, Loader2, TrendingUp, TrendingDown, DollarSign,
  Users, Phone, Target, AlertTriangle, Zap, Shield, Eye,
  RefreshCw, ArrowRight, Sparkles, BarChart3, Activity,
  ChevronDown, Copy, CheckCircle, XCircle, Clock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chartColors";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: Date;
  loading?: boolean;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: React.ElementType;
  color: string;
}

/* ═══════════════════════════════════════════════════════════
   DATA HOOKS — Pull ALL business data for the AI
   ═══════════════════════════════════════════════════════════ */

function useBusinessSnapshot() {
  return useQuery({
    queryKey: ["biz-snapshot"],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const start = thirtyDaysAgo.toISOString().split("T")[0];

      const [
        dealsRes, contactsRes, callsRes, fbRes, healthRes, coachRes,
      ] = await Promise.all([
        supabase.from("deals").select("id, deal_value, amount, stage, created_at, close_date, owner_id").gte("created_at", start),
        supabase.from("contacts").select("id, email, lifecycle_stage, lead_status, hubspot_owner_id, created_at", { count: "exact" }).gte("created_at", start),
        supabase.from("call_records").select("id, call_type, duration, is_lost, owner_name, created_at").gte("created_at", start),
        supabase.from("facebook_ads_insights").select("spend, impressions, clicks, leads, ctr, cpc, roas, campaign_name, date").gte("date", start),
        supabase.from("client_health_scores").select("health_score, health_zone, outstanding_sessions, package_value_aed, assigned_coach").order("calculated_at", { ascending: false }).limit(500),
        supabase.from("coach_performance").select("*").limit(50),
      ]);

      const deals = dealsRes.data || [];
      const contacts = contactsRes.data || [];
      const calls = callsRes.data || [];
      const fb = fbRes.data || [];
      const health = healthRes.data || [];
      const coaches = coachRes.data || [];

      // Compute KPIs
      const totalDeals = deals.length;
      const closedWon = deals.filter(d => d.stage === "closedwon" || d.stage === "closed_won");
      const totalRevenue = closedWon.reduce((s, d) => s + (Number(d.deal_value) || Number(d.amount) || 0), 0);
      const newLeads = contactsRes.count || contacts.length;
      const totalCalls = calls.length;
      const missedCalls = calls.filter(c => c.is_lost).length;
      const totalAdSpend = fb.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const totalFbLeads = fb.reduce((s, r) => s + (r.leads || 0), 0);
      const avgCpl = totalFbLeads > 0 ? totalAdSpend / totalFbLeads : 0;
      const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0;

      // Health zones (DB uses uppercase: RED, YELLOW, GREEN, PURPLE)
      const criticalClients = health.filter(h => h.health_zone === "RED").length;
      const warningClients = health.filter(h => h.health_zone === "YELLOW").length;
      const healthyClients = health.filter(h => h.health_zone === "GREEN" || h.health_zone === "PURPLE").length;
      const revenueAtRisk = health
        .filter(h => h.health_zone === "RED" || h.health_zone === "YELLOW")
        .reduce((s, h) => s + (Number(h.package_value_aed) || 0), 0);

      // Conversion funnel — using real HubSpot stage IDs
      // Assessments = Assessment Confirmed (122237508) + Assessment Done (2900542)
      const assessments = deals.filter(d => 
        d.stage === "122237508" || d.stage === "2900542" || d.stage === "contractsent"
      ).length;
      // Proposals = Assessment Scheduled (qualifiedtobuy) + Called-Follow up (decisionmakerboughtin)
      const proposals = deals.filter(d => 
        d.stage === "qualifiedtobuy" || d.stage === "decisionmakerboughtin"
      ).length;
      const closedCount = closedWon.length;
      const lostDeals = deals.filter(d => 
        d.stage === "closedlost" || d.stage === "1063991961" || d.stage === "1070354491"
      ).length;
      const closeRate = (assessments + proposals) > 0 ? (closedCount / (assessments + proposals + closedCount + lostDeals)) * 100 : 0;

      // Top campaigns
      const campaignMap = new Map<string, { spend: number; leads: number; clicks: number }>();
      fb.forEach(r => {
        const name = r.campaign_name || "Unknown";
        const existing = campaignMap.get(name) || { spend: 0, leads: 0, clicks: 0 };
        existing.spend += Number(r.spend) || 0;
        existing.leads += r.leads || 0;
        existing.clicks += r.clicks || 0;
        campaignMap.set(name, existing);
      });
      const topCampaigns = Array.from(campaignMap.entries())
        .map(([name, d]) => ({ name, ...d, cpl: d.leads > 0 ? d.spend / d.leads : 0 }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

      return {
        kpis: {
          totalRevenue, totalDeals, closedCount, newLeads, totalCalls, missedCalls,
          totalAdSpend, avgCpl, roas, criticalClients, warningClients, healthyClients,
          revenueAtRisk, closeRate, lostDeals, totalFbLeads,
        },
        funnel: {
          leads: newLeads,
          assessments,
          proposals,
          closed: closedCount,
          lost: lostDeals,
        },
        topCampaigns,
        coaches,
        healthBreakdown: { critical: criticalClients, warning: warningClients, healthy: healthyClients },
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

/* ═══════════════════════════════════════════════════════════
   AI CHAT — Calls ptd-agent-atlas with full business context
   ═══════════════════════════════════════════════════════════ */

function useAIChat(snapshot: ReturnType<typeof useBusinessSnapshot>["data"]) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isLoading) return;

    const userMsg: ChatMsg = {
      id: `u_${Date.now()}`,
      role: "user",
      content: prompt,
      ts: new Date(),
    };

    const assistantId = `a_${Date.now()}`;
    const placeholderMsg: ChatMsg = {
      id: assistantId,
      role: "assistant",
      content: "",
      ts: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMsg, placeholderMsg]);
    setIsLoading(true);

    try {
      // Build context from snapshot
      const context = snapshot ? `
LIVE BUSINESS DATA (Last 30 Days):
- Revenue: AED ${snapshot.kpis.totalRevenue.toLocaleString()}
- Total Deals: ${snapshot.kpis.totalDeals} (Closed Won: ${snapshot.kpis.closedCount}, Lost: ${snapshot.kpis.lostDeals})
- Close Rate: ${snapshot.kpis.closeRate.toFixed(1)}%
- New Leads: ${snapshot.kpis.newLeads}
- Total Calls: ${snapshot.kpis.totalCalls} (Missed: ${snapshot.kpis.missedCalls})
- Ad Spend: AED ${snapshot.kpis.totalAdSpend.toLocaleString()} | CPL: AED ${snapshot.kpis.avgCpl.toFixed(0)} | ROAS: ${snapshot.kpis.roas.toFixed(2)}x
- FB Leads: ${snapshot.kpis.totalFbLeads}
- Client Health: ${snapshot.kpis.criticalClients} critical, ${snapshot.kpis.warningClients} warning, ${snapshot.kpis.healthyClients} healthy
- Revenue at Risk: AED ${snapshot.kpis.revenueAtRisk.toLocaleString()}
- Conversion Funnel: ${snapshot.funnel.leads} leads → ${snapshot.funnel.assessments} assessments → ${snapshot.funnel.proposals} proposals → ${snapshot.funnel.closed} closed / ${snapshot.funnel.lost} lost
- Top Campaigns: ${snapshot.topCampaigns.map(c => `${c.name}: AED ${c.spend.toFixed(0)} spend, ${c.leads} leads, CPL AED ${c.cpl.toFixed(0)}`).join(" | ")}
` : "No data loaded yet.";

      const { data, error } = await supabase.functions.invoke("business-intelligence", {
        body: {
          message: prompt,
          context,
          agent: "ceo-advisor",
          systemPrompt: `You are the PTD Fitness CEO AI Advisor — the most strategic business intelligence agent.
Company: PTD Fitness — premium mobile personal training, Dubai & Abu Dhabi.
Clients: Executives & professionals 40+. Packages: 3,520–41,616 AED.

YOUR MISSION: Make this business print money. Prevent every AED of loss.

RULES:
1. ALWAYS reference the LIVE DATA above. Never make up numbers.
2. Lead with the MOST IMPACTFUL insight first.
3. Give SPECIFIC, ACTIONABLE recommendations with expected AED impact.
4. Flag URGENT issues (revenue at risk, lost leads, declining metrics) FIRST.
5. Think like a CFO + CMO + COO combined.
6. Use AED currency always.
7. Be direct, no fluff. Every sentence must add value.
8. When analyzing campaigns, compare CPL to benchmark (target: < AED 150).
9. When analyzing health scores, flag clients with < 3 sessions remaining as CHURN RISK.
10. Calculate opportunity cost of missed calls and lost leads.`,
        },
      });

      if (error) throw error;

      const response = data?.output || data?.response || data?.content || data?.text ||
        (typeof data === "string" ? data : JSON.stringify(data));

      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: response, loading: false } : m)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get AI response";
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `❌ Error: ${msg}`, loading: false } : m)
      );
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, snapshot]);

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearChat };
}

/* ═══════════════════════════════════════════════════════════
   QUICK ACTIONS — One-click deep dives
   ═══════════════════════════════════════════════════════════ */

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Revenue Leaks",
    prompt: "Analyze all revenue leaks: missed calls converting to lost leads, deals stuck in pipeline, clients at risk of churning, and campaigns with high CPL. For each leak, estimate AED impact and give me the fix.",
    icon: DollarSign,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  {
    label: "Money Maker Plan",
    prompt: "Create a 7-day money-making action plan. Prioritize by AED impact: which campaigns to scale, which leads to call back immediately, which clients need intervention today, and where to reallocate budget.",
    icon: TrendingUp,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    label: "Lead Intelligence",
    prompt: "Deep dive on lead quality and conversion: What's our lead-to-close rate? Where are leads dropping off? Which sources produce the best leads? How many leads are being wasted by slow follow-up? Calculate the AED cost of every wasted lead.",
    icon: Users,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    label: "Campaign Optimizer",
    prompt: "Analyze all Meta ad campaigns. Which should I scale (ROAS > 3x)? Which should I kill (CPL > 200 AED)? Where is budget being wasted? Give me exact budget reallocation with projected impact.",
    icon: Target,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    label: "Churn Prevention",
    prompt: "Emergency churn analysis: List all critical and warning clients with their remaining sessions, deal value, and assigned coach. For each, give me a specific retention action to take TODAY. Calculate total revenue at risk.",
    icon: Shield,
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    label: "Sales Team Audit",
    prompt: "Full sales team performance audit: close rates by setter, call volume, missed calls, response time. Who's performing? Who needs coaching? Where are deals dying? Give me coaching actions for each person.",
    icon: Activity,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    label: "Competitor Edge",
    prompt: "Based on our data, what's our competitive position? What pricing insights can we extract? Where should we double down? What new market segments should we target in Dubai/Abu Dhabi? Give me 3 bold moves.",
    icon: Zap,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  {
    label: "Full Business Review",
    prompt: "Complete business health check. Score each area 1-10: Marketing efficiency, Sales effectiveness, Client retention, Revenue growth, Operational efficiency. For anything below 7, give me the specific fix with timeline and expected AED impact.",
    icon: Brain,
    color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  },
];

/* ═══════════════════════════════════════════════════════════
   KPI CARDS
   ═══════════════════════════════════════════════════════════ */

function KPIGrid({ kpis }: { kpis: ReturnType<typeof useBusinessSnapshot>["data"] extends infer T ? T extends { kpis: infer K } ? K : never : never }) {
  const cards = [
    { label: "Revenue", value: `AED ${(kpis.totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign, color: "text-emerald-400", sub: `${kpis.closedCount} deals closed` },
    { label: "ROAS", value: `${kpis.roas.toFixed(1)}x`, icon: TrendingUp, color: kpis.roas >= 3 ? "text-emerald-400" : "text-amber-400", sub: `AED ${(kpis.totalAdSpend / 1000).toFixed(0)}K spend` },
    { label: "New Leads", value: kpis.newLeads.toLocaleString(), icon: Users, color: "text-blue-400", sub: `CPL AED ${kpis.avgCpl.toFixed(0)}` },
    { label: "Close Rate", value: `${kpis.closeRate.toFixed(1)}%`, icon: Target, color: kpis.closeRate >= 20 ? "text-emerald-400" : "text-amber-400", sub: `${kpis.lostDeals} lost` },
    { label: "Calls", value: kpis.totalCalls.toLocaleString(), icon: Phone, color: "text-cyan-400", sub: `${kpis.missedCalls} missed (${kpis.totalCalls > 0 ? ((kpis.missedCalls / kpis.totalCalls) * 100).toFixed(0) : 0}%)` },
    { label: "At Risk", value: `AED ${(kpis.revenueAtRisk / 1000).toFixed(0)}K`, icon: AlertTriangle, color: kpis.revenueAtRisk > 50000 ? "text-rose-400" : "text-amber-400", sub: `${kpis.criticalClients} critical clients` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="bg-black/40 border-white/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
            </div>
            <p className={`text-xl font-mono font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONVERSION FUNNEL
   ═══════════════════════════════════════════════════════════ */

function ConversionFunnel({ funnel }: { funnel: { leads: number; assessments: number; proposals: number; closed: number; lost: number } }) {
  const steps = [
    { label: "Leads", value: funnel.leads, color: "bg-blue-500/20 border-blue-500/30 text-blue-400", icon: Users },
    { label: "Assessments", value: funnel.assessments, color: "bg-cyan-500/20 border-cyan-500/30 text-cyan-400", icon: Phone },
    { label: "Proposals", value: funnel.proposals, color: "bg-violet-500/20 border-violet-500/30 text-violet-400", icon: Target },
    { label: "Closed Won", value: funnel.closed, color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400", icon: CheckCircle },
    { label: "Lost", value: funnel.lost, color: "bg-rose-500/20 border-rose-500/30 text-rose-400", icon: XCircle },
  ];

  const maxVal = Math.max(...steps.map(s => s.value), 1);

  return (
    <Card className="bg-black/40 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Conversion Funnel (30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, i) => {
          const pct = funnel.leads > 0 && i > 0 ? ((step.value / funnel.leads) * 100).toFixed(1) : "100";
          const barWidth = Math.max(5, (step.value / maxVal) * 100);
          return (
            <div key={step.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <step.icon className={`h-3.5 w-3.5 ${step.color.split(" ").pop()}`} />
                  <span className="text-muted-foreground">{step.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{step.value.toLocaleString()}</span>
                  {i > 0 && <span className="text-xs text-muted-foreground">({pct}%)</span>}
                </div>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${step.color.replace("border-", "bg-").replace("/30", "/40").replace("/20", "/40")}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLIENT HEALTH DISTRIBUTION
   ═══════════════════════════════════════════════════════════ */

function HealthDistribution({ breakdown }: { breakdown: { critical: number; warning: number; healthy: number } }) {
  const total = breakdown.critical + breakdown.warning + breakdown.healthy;
  const segments = [
    { label: "Healthy", count: breakdown.healthy, color: "bg-emerald-500", pct: total > 0 ? ((breakdown.healthy / total) * 100).toFixed(0) : "0" },
    { label: "Warning", count: breakdown.warning, color: "bg-amber-500", pct: total > 0 ? ((breakdown.warning / total) * 100).toFixed(0) : "0" },
    { label: "Critical", count: breakdown.critical, color: "bg-rose-500", pct: total > 0 ? ((breakdown.critical / total) * 100).toFixed(0) : "0" },
  ];

  return (
    <Card className="bg-black/40 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Client Health ({total} active)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {segments.map(s => (
            <div key={s.label} className={`${s.color} transition-all duration-500`} style={{ width: `${s.pct}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {segments.map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-2xl font-mono font-bold ${s.color.replace("bg-", "text-")}`}>{s.count}</div>
              <div className="text-xs text-muted-foreground">{s.label} ({s.pct}%)</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   AI CHAT COMPONENT
   ═══════════════════════════════════════════════════════════ */

function AIChat({ snapshot }: { snapshot: ReturnType<typeof useBusinessSnapshot>["data"] }) {
  const { messages, isLoading, sendMessage, clearChat } = useAIChat(snapshot);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="bg-black/40 border-white/10 flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-sm">PTD Business AI</span>
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Live Data</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs text-muted-foreground">
          Clear
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
            <Brain className="h-10 w-10 text-primary/40" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">PTD Business Intelligence AI</p>
              <p className="text-xs text-muted-foreground/60 max-w-sm">
                Ask anything about your business. I have live access to all your data — revenue, leads, campaigns, calls, client health, and more.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {QUICK_ACTIONS.slice(0, 4).map(qa => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.prompt)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left hover:bg-white/5 transition-colors ${qa.color}`}
                >
                  <qa.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs">{qa.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`mb-3 ${msg.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-white/5 border border-white/10 rounded-bl-sm"
            }`}>
              {msg.loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs text-muted-foreground">Analyzing your business data...</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about revenue, leads, campaigns, clients..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
          />
          <Button size="sm" onClick={handleSend} disabled={!input.trim() || isLoading} className="shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   TOP CAMPAIGNS TABLE
   ═══════════════════════════════════════════════════════════ */

function TopCampaigns({ campaigns }: { campaigns: Array<{ name: string; spend: number; leads: number; cpl: number }> }) {
  return (
    <Card className="bg-black/40 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Top Campaigns
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {campaigns.map((c, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="truncate max-w-[200px] text-sm">{c.name}</div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-muted-foreground">AED {c.spend.toFixed(0)}</span>
                <span className="text-blue-400">{c.leads} leads</span>
                <span className={c.cpl < 150 ? "text-emerald-400" : c.cpl < 300 ? "text-amber-400" : "text-rose-400"}>
                  CPL {c.cpl.toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function BusinessIntelligenceAI() {
  const { data: snapshot, isLoading, refetch, isRefetching } = useBusinessSnapshot();

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-violet-500 to-blue-600 bg-clip-text text-transparent">
            PTD Business Intelligence AI
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live data • AI-powered insights • Real-time decisions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetch(); toast.success("Refreshing all data..."); }}
          disabled={isLoading || isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Strip */}
      {isLoading ? (
        <div className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : snapshot ? (
        <KPIGrid kpis={snapshot.kpis} />
      ) : null}

      {/* Main Content: Funnel + Health + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Funnel + Health + Campaigns */}
        <div className="lg:col-span-1 space-y-4">
          {snapshot && <ConversionFunnel funnel={snapshot.funnel} />}
          {snapshot && <HealthDistribution breakdown={snapshot.healthBreakdown} />}
          {snapshot && <TopCampaigns campaigns={snapshot.topCampaigns} />}
        </div>

        {/* Right: AI Chat */}
        <div className="lg:col-span-2">
          <AIChat snapshot={snapshot} />
        </div>
      </div>

      {/* Quick Actions Grid */}
      <Card className="bg-black/40 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Deep Dives — Click to analyze
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {QUICK_ACTIONS.map(qa => (
              <button
                key={qa.label}
                onClick={() => {
                  // Scroll to chat and send
                  const chatInput = document.querySelector("textarea");
                  if (chatInput) chatInput.scrollIntoView({ behavior: "smooth" });
                  // Small delay for scroll
                  setTimeout(() => {
                    const event = new CustomEvent("ai-quick-action", { detail: qa.prompt });
                    window.dispatchEvent(event);
                  }, 300);
                }}
                className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-left hover:bg-white/5 transition-all ${qa.color}`}
              >
                <qa.icon className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">{qa.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
