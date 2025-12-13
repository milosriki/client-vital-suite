import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function StripeIntelligence() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch Stripe dashboard data
  const { data: stripeData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["stripe-dashboard-data"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-dashboard-data", {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Fetch forensic data
  const { data: forensicData, isLoading: forensicLoading } = useQuery({
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const context = {
        balance: stripeData?.balance,
        recentPayments: stripeData?.payments?.slice(0, 10),
        customers: stripeData?.customers?.length,
        subscriptions: stripeData?.subscriptions?.length,
        account: stripeData?.account,
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
    "What's my current balance?",
    "Show recent payments",
    "Any suspicious activity?",
    "When is my next payout?",
    "Revenue this month?",
  ];

  const balance = stripeData?.balance;
  const availableBalance = balance?.available?.[0]?.amount || 0;
  const pendingBalance = balance?.pending?.[0]?.amount || 0;
  const currency = balance?.available?.[0]?.currency || "aed";

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stripe Intelligence</h1>
          <p className="text-muted-foreground">Real-time financial data & AI analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Stripe
            </a>
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-dashboard">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold font-mono text-success">
                    {formatCurrency(availableBalance, currency)}
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Balance</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold font-mono text-warning">
                    {formatCurrency(pendingBalance, currency)}
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Customers</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold font-mono">{stripeData?.customers?.length || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-dashboard">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Payments</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold font-mono">{stripeData?.payments?.length || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
            </div>
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
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Account Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-border/50">
                        <span className="text-muted-foreground">Business Name</span>
                        <span className="font-medium">{stripeData?.account?.business_profile?.name || "N/A"}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-border/50">
                        <span className="text-muted-foreground">Country</span>
                        <span className="font-medium">{stripeData?.account?.country || "N/A"}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-border/50">
                        <span className="text-muted-foreground">Currency</span>
                        <span className="font-medium uppercase">{stripeData?.account?.default_currency || "N/A"}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-border/50">
                        <span className="text-muted-foreground">Payments Enabled</span>
                        <Badge variant={stripeData?.account?.charges_enabled ? "default" : "destructive"}>
                          {stripeData?.account?.charges_enabled ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <span className="text-muted-foreground">Payouts Enabled</span>
                        <Badge variant={stripeData?.account?.payouts_enabled ? "default" : "destructive"}>
                          {stripeData?.account?.payouts_enabled ? "Yes" : "No"}
                        </Badge>
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
                    Recent Payments
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
                      <p className="text-center text-muted-foreground py-8">No payments found</p>
                    ) : (
                      <div className="space-y-3">
                        {stripeData?.payments?.slice(0, 20).map((payment: any) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-full flex items-center justify-center",
                                  payment.status === "succeeded" ? "bg-success/10" : "bg-destructive/10"
                                )}
                              >
                                {payment.status === "succeeded" ? (
                                  <ArrowUpRight className="h-5 w-5 text-success" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {formatCurrency(payment.amount, payment.currency)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(payment.created * 1000).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Badge variant={payment.status === "succeeded" ? "default" : "destructive"}>
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

            <TabsContent value="payouts">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownRight className="h-5 w-5" />
                    Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {forensicLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : !forensicData?.payouts?.length ? (
                      <p className="text-center text-muted-foreground py-8">No payouts found</p>
                    ) : (
                      <div className="space-y-3">
                        {forensicData.payouts.map((payout: any) => (
                          <div
                            key={payout.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <ArrowDownRight className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {formatCurrency(payout.amount, payout.currency)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(payout.created * 1000).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Badge>{payout.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="anomalies">
              <Card className="card-dashboard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Detected Anomalies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {forensicLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : !forensicData?.anomalies?.length ? (
                      <div className="text-center py-8">
                        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                          <Sparkles className="h-8 w-8 text-success" />
                        </div>
                        <p className="text-muted-foreground">No anomalies detected</p>
                        <p className="text-sm text-muted-foreground mt-1">Your account looks healthy!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {forensicData.anomalies.map((anomaly: any, i: number) => (
                          <div
                            key={i}
                            className={cn(
                              "p-4 rounded-lg border",
                              anomaly.severity === "critical"
                                ? "bg-destructive/10 border-destructive/30"
                                : anomaly.severity === "high"
                                ? "bg-warning/10 border-warning/30"
                                : "bg-muted/30 border-border/50"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle
                                className={cn(
                                  "h-5 w-5 mt-0.5",
                                  anomaly.severity === "critical"
                                    ? "text-destructive"
                                    : anomaly.severity === "high"
                                    ? "text-warning"
                                    : "text-muted-foreground"
                                )}
                              />
                              <div>
                                <p className="font-medium">{anomaly.type}</p>
                                <p className="text-sm text-muted-foreground mt-1">{anomaly.message}</p>
                              </div>
                            </div>
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
              <p className="text-sm text-muted-foreground">Ask anything about your Stripe data</p>
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
                        onClick={() => {
                          setInputMessage(q);
                        }}
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
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-4 py-2 text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
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
