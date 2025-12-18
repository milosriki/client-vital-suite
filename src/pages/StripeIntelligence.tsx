import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Send,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Users,
  Receipt,
  Bot,
  Sparkles,
  ExternalLink,
  CalendarIcon,
  Filter,
  BarChart3,
  PieChart,
  Repeat,
  XCircle,
  CheckCircle,
  Clock,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const PRESET_RANGES = [
  { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: "Last 7 days", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Last 30 days", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "This month", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last month", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Last 3 months", getValue: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { label: "This year", getValue: () => ({ from: startOfYear(new Date()), to: new Date() }) },
  { label: "All time", getValue: () => ({ from: undefined, to: undefined }) },
];

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export default function StripeIntelligence() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPreset, setSelectedPreset] = useState("All time");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch Stripe dashboard data with date range
  const { data: stripeData, isLoading, refetch, isRefetching } = useDedupedQuery({
    queryKey: ["stripe-dashboard-data", dateRange.from?.toISOString(), dateRange.to?.toISOString(), statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-dashboard-data", {
        body: {
          startDate: dateRange.from?.toISOString(),
          endDate: dateRange.to?.toISOString(),
          status: statusFilter !== "all" ? statusFilter : undefined,
          limit: 100,
        },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Fetch forensic data
  const { data: forensicData, isLoading: forensicLoading } = useDedupedQuery({
    queryKey: ["stripe-forensics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-forensics", {
        body: { action: "complete-intelligence", days: 30 },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 120000,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const formatCurrency = (amount: number, currency = "aed") => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const presetConfig = PRESET_RANGES.find(p => p.label === preset);
    if (presetConfig) {
      setDateRange(presetConfig.getValue());
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const context = {
        balance: stripeData?.balance,
        metrics: stripeData?.metrics,
        recentPayments: stripeData?.payments?.slice(0, 10),
        customers: stripeData?.customers?.length,
        subscriptions: stripeData?.subscriptions?.length,
        account: stripeData?.account,
        dateRange: {
          from: dateRange.from?.toISOString(),
          to: dateRange.to?.toISOString(),
        },
        forensics: forensicData ? {
          anomalies: forensicData.anomalies?.slice(0, 5),
          moneyFlow: forensicData.moneyFlow?.slice(0, 10),
          payouts: forensicData.payouts?.slice(0, 5),
        } : null,
      };

      const response = await fetch(
        `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/stripe-payouts-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "chat",
            message: userMessage,
            context,
            history: chatMessages,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast({ title: "Rate limited", description: "Please try again in a moment", variant: "destructive" });
          return;
        }
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                assistantMessage += content;
                setChatMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantMessage };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  const quickQuestions = [
    "What's my revenue this period?",
    "Show payment trends",
    "Any failed payments?",
    "Compare to last month",
    "Top customers by value",
  ];

  const balance = stripeData?.balance;
  const availableBalance = balance?.available?.[0]?.amount || 0;
  const pendingBalance = balance?.pending?.[0]?.amount || 0;
  const currency = balance?.available?.[0]?.currency || "aed";
  const metrics = stripeData?.metrics || {};

  // Prepare chart data
  const chartData = stripeData?.chartData || [];
  
  // Payment status breakdown for pie chart
  const statusBreakdown = [
    { name: "Successful", value: metrics.successfulPaymentsCount || 0, color: "hsl(var(--success))" },
    { name: "Failed", value: metrics.failedPaymentsCount || 0, color: "hsl(var(--destructive))" },
  ].filter(item => item.value > 0);

  // Subscription status breakdown
  const subStatusBreakdown = [
    { name: "Active", value: metrics.activeSubscriptions || 0, color: "hsl(var(--success))" },
    { name: "Trialing", value: metrics.trialSubscriptions || 0, color: "hsl(var(--warning))" },
    { name: "Canceled", value: metrics.canceledSubscriptions || 0, color: "hsl(var(--destructive))" },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Stripe Intelligence Pro</h1>
          <p className="text-muted-foreground">Advanced financial analytics & AI insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Preset */}
          <Select value={selectedPreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[160px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {PRESET_RANGES.map((preset) => (
                <SelectItem key={preset.label} value={preset.label}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[220px] justify-start">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  "All time"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                  setSelectedPreset("Custom");
                }}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Stripe
            </a>
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Available</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-success">
                    {formatCurrency(availableBalance, currency)}
                  </p>
                )}
              </div>
              <Wallet className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-warning">
                    {formatCurrency(pendingBalance, currency)}
                  </p>
                )}
              </div>
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Net Revenue</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono">
                    {formatCurrency(metrics.netRevenue || 0, currency)}
                  </p>
                )}
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">MRR</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-primary">
                    {formatCurrency(metrics.mrr || 0, currency)}
                  </p>
                )}
              </div>
              <Repeat className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-success">{metrics.successRate || 100}%</p>
                )}
              </div>
              <Percent className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Refunded</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-destructive">
                    {formatCurrency(metrics.totalRefunded || 0, currency)}
                  </p>
                )}
              </div>
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="card-dashboard lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(new Date(date), "MMM d")}
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tickFormatter={(val) => `${(val / 100).toFixed(0)}`}
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload?.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-sm font-medium">{format(new Date(label), "MMM d, yyyy")}</p>
                            <p className="text-sm text-success">
                              Revenue: {formatCurrency(payload[0].value as number, currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(payload[0].payload as any).count} payments
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Status Pie */}
        <Card className="card-dashboard">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : statusBreakdown.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No payments in period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                            <p className="text-sm">{payload[0].name}: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Period Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-xl font-bold">{formatCurrency(metrics.totalRevenue || 0, currency)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">Total Payouts</p>
                        <p className="text-xl font-bold">{formatCurrency(metrics.totalPayouts || 0, currency)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">Successful Payments</p>
                        <p className="text-xl font-bold text-success">{metrics.successfulPaymentsCount || 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">Failed Payments</p>
                        <p className="text-xl font-bold text-destructive">{metrics.failedPaymentsCount || 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                        <p className="text-xl font-bold">{metrics.activeSubscriptions || 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">Customers</p>
                        <p className="text-xl font-bold">{stripeData?.customers?.length || 0}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payments ({stripeData?.payments?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : stripeData?.payments?.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No payments in selected period</p>
                    ) : (
                      <div className="space-y-2">
                        {stripeData?.payments?.map((payment: any) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-9 w-9 rounded-full flex items-center justify-center",
                                  payment.status === "succeeded" ? "bg-success/10" : "bg-destructive/10"
                                )}
                              >
                                {payment.status === "succeeded" ? (
                                  <CheckCircle className="h-4 w-4 text-success" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm font-mono">
                                  {formatCurrency(payment.amount, payment.currency)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(payment.created * 1000), "MMM d, yyyy HH:mm")}
                                </p>
                              </div>
                            </div>
                            <Badge variant={payment.status === "succeeded" ? "default" : "destructive"} className="text-xs">
                              {payment.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Repeat className="h-5 w-5" />
                    Subscriptions ({stripeData?.subscriptions?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : stripeData?.subscriptions?.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No subscriptions found</p>
                    ) : (
                      <div className="space-y-2">
                        {stripeData?.subscriptions?.map((sub: any) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-9 w-9 rounded-full flex items-center justify-center",
                                  sub.status === "active" ? "bg-success/10" : 
                                  sub.status === "trialing" ? "bg-warning/10" : "bg-destructive/10"
                                )}
                              >
                                <Repeat className={cn(
                                  "h-4 w-4",
                                  sub.status === "active" ? "text-success" : 
                                  sub.status === "trialing" ? "text-warning" : "text-destructive"
                                )} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {sub.items?.data?.[0]?.price?.product || "Subscription"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(sub.current_period_end * 1000), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={sub.status === "active" ? "default" : sub.status === "trialing" ? "secondary" : "destructive"}
                              className="text-xs"
                            >
                              {sub.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payouts">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownRight className="h-5 w-5" />
                    Payouts ({stripeData?.payouts?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : stripeData?.payouts?.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No payouts in selected period</p>
                    ) : (
                      <div className="space-y-2">
                        {stripeData?.payouts?.map((payout: any) => (
                          <div
                            key={payout.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <ArrowDownRight className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm font-mono">
                                  {formatCurrency(payout.amount, payout.currency)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(payout.created * 1000), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            <Badge className="text-xs">{payout.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customers">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customers ({stripeData?.customers?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : stripeData?.customers?.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No customers found</p>
                    ) : (
                      <div className="space-y-2">
                        {stripeData?.customers?.map((customer: any) => (
                          <div
                            key={customer.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{customer.name || customer.email || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">{customer.email}</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(customer.created * 1000), "MMM d, yyyy")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* AI Chat Panel */}
        <div className="lg:col-span-1">
          <Card className="card-dashboard h-[600px] flex flex-col">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Stripe AI Assistant
              </CardTitle>
              <p className="text-sm text-muted-foreground">Ask anything about your data</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* Quick Questions */}
              {chatMessages.length === 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickQuestions.map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setInputMessage(q)}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-4 py-2 text-sm",
                          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isStreaming && chatMessages[chatMessages.length - 1]?.content === "" && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                          <div className="h-2 w-2 rounded-full bg-primary animate-bounce delay-100" />
                          <div className="h-2 w-2 rounded-full bg-primary animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="flex gap-2 mt-4">
                <Input
                  placeholder="Ask about your Stripe data..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  disabled={isStreaming}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={isStreaming || !inputMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}