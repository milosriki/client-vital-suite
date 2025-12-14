import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BanknoteIcon,
  Users,
  Shield,
  Loader2,
  Maximize2,
  X
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface StripeAIDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "test" | "live";
}

interface PayoutData {
  payouts: any[];
  transfers: any[];
  balance: any;
  balanceTransactions: any[];
}

export default function StripeAIDashboard({ open, onOpenChange, mode }: StripeAIDashboardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: payoutData, isLoading, refetch } = useQuery({
    queryKey: ['stripe-payouts-data', mode],
    queryFn: async (): Promise<PayoutData> => {
      const { data, error } = await supabase.functions.invoke('stripe-payouts-ai', {
        body: { mode, action: 'fetch-data' }
      });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      // Use hardcoded values for standalone operation
      const supabaseUrl = "https://ztjndilxurtsfqdsvfds.supabase.co";
      const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo";
      
      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-payouts-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          mode,
          action: 'chat',
          message: userMessage,
          context: payoutData,
          history: messages
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
          setIsStreaming(false);
          return;
        }
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { role: "assistant", content: assistantContent };
                  return newMessages;
                });
              }
            } catch {}
          }
        }
      }
    } catch (error: any) {
      toast.error("Failed to get AI response: " + error.message);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      paid: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      pending: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
      in_transit: { variant: "secondary", icon: <ArrowUpRight className="h-3 w-3" /> },
      canceled: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    };
    const config = statusConfig[status] || { variant: "outline" as const, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const quickQuestions = [
    "Show me all payouts this month",
    "Any failed or pending payouts?",
    "Who received the last transfer?",
    "What's my available balance?",
    "Show suspicious transactions"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BanknoteIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Stripe Payouts & Transfers AI</DialogTitle>
              <p className="text-sm text-muted-foreground">Ask anything about your payouts, transfers, and balance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {mode.toUpperCase()}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Data */}
          <div className="w-1/2 border-r overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {/* Balance Overview */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Balance Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Available</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(payoutData?.balance?.available?.[0]?.amount || 0, payoutData?.balance?.available?.[0]?.currency || 'usd')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pending</p>
                          <p className="text-xl font-bold text-yellow-600">
                            {formatCurrency(payoutData?.balance?.pending?.[0]?.amount || 0, payoutData?.balance?.pending?.[0]?.currency || 'usd')}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Payouts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4" />
                      Recent Payouts ({payoutData?.payouts?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : payoutData?.payouts?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Amount</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Arrival</TableHead>
                            <TableHead className="text-xs">Method</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payoutData.payouts.slice(0, 10).map((payout: any) => (
                            <TableRow key={payout.id}>
                              <TableCell className="font-medium">
                                {formatCurrency(payout.amount, payout.currency)}
                              </TableCell>
                              <TableCell>{getStatusBadge(payout.status)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(payout.arrival_date * 1000).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-xs">{payout.type}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="p-4 text-center text-muted-foreground text-sm">No payouts found</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Transfers */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Recent Transfers ({payoutData?.transfers?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : payoutData?.transfers?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Amount</TableHead>
                            <TableHead className="text-xs">Destination</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payoutData.transfers.slice(0, 10).map((transfer: any) => (
                            <TableRow key={transfer.id}>
                              <TableCell className="font-medium">
                                {formatCurrency(transfer.amount, transfer.currency)}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {transfer.destination?.slice(0, 15)}...
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(transfer.created * 1000).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="p-4 text-center text-muted-foreground text-sm">No transfers found</p>
                    )}
                  </CardContent>
                </Card>

                {/* Balance Transactions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BanknoteIcon className="h-4 w-4" />
                      Balance Transactions ({payoutData?.balanceTransactions?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : payoutData?.balanceTransactions?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Amount</TableHead>
                            <TableHead className="text-xs">Net</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payoutData.balanceTransactions.slice(0, 10).map((tx: any) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-xs font-medium capitalize">{tx.type}</TableCell>
                              <TableCell className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(tx.amount, tx.currency)}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(tx.net, tx.currency)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(tx.created * 1000).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="p-4 text-center text-muted-foreground text-sm">No transactions found</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - AI Chat */}
          <div className="w-1/2 flex flex-col">
            <div className="p-3 border-b bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      setInput(q);
                    }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                      <Bot className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Stripe Payouts AI Assistant</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Ask me anything about your payouts, transfers, balance history, or suspicious activity.
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {isStreaming && messages[messages.length - 1]?.content === "" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about payouts, transfers, balance..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={isStreaming}
                />
                <Button onClick={handleSend} disabled={isStreaming || !input.trim()}>
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
