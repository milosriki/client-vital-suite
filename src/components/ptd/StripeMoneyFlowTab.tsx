import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  CreditCard,
  Building2,
  Wallet,
  AlertTriangle,
  DollarSign,
  ArrowLeftRight
} from "lucide-react";
import { toast } from "sonner";

interface MoneyFlowEvent {
  id: string;
  type: 'inflow' | 'outflow' | 'internal';
  category: string;
  amount: number;
  currency: string;
  timestamp: number;
  source: string;
  destination: string;
  description: string;
  metadata: any;
  status: string;
  traceId?: string;
}

interface MoneyFlowData {
  moneyFlow: MoneyFlowEvent[];
  summary: {
    totalInflow: number;
    totalOutflow: number;
    netFlow: number;
    transactionCount: number;
    flowByCategory: Record<string, { count: number; amount: number }>;
    destinationAnalysis: Record<string, { count: number; amount: number; type: string }>;
  };
  balance: any;
  issuing: {
    enabled: boolean;
    cards: any[];
    transactions: number;
    pendingAuthorizations: number;
  };
  period: { days: number; from: string; to: string };
}

interface StripeMoneyFlowTabProps {
  mode: "test" | "live";
}

export function StripeMoneyFlowTab({ mode }: StripeMoneyFlowTabProps) {
  const [days, setDays] = useState(30);
  const [filterType, setFilterType] = useState<string>("all");

  const { data, isLoading, refetch, isRefetching } = useQuery<MoneyFlowData>({
    queryKey: ["stripe-money-flow", mode, days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-forensics", {
        body: { action: "money-flow", days }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000
  });

  const formatCurrency = (amount: number, currency = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getFlowIcon = (type: string, category: string) => {
    if (type === 'inflow') return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    if (type === 'outflow') {
      if (category === 'payout' || category === 'instant_payout') return <Building2 className="h-4 w-4 text-red-500" />;
      if (category === 'card_spend') return <CreditCard className="h-4 w-4 text-orange-500" />;
      if (category === 'refund') return <ArrowLeftRight className="h-4 w-4 text-yellow-500" />;
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    }
    return <Wallet className="h-4 w-4 text-muted-foreground" />;
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
      payment: { variant: "default", label: "Payment" },
      payout: { variant: "destructive", label: "Payout" },
      instant_payout: { variant: "destructive", label: "Instant Payout" },
      refund: { variant: "secondary", label: "Refund" },
      transfer: { variant: "outline", label: "Transfer" },
      card_spend: { variant: "secondary", label: "Card Spend" },
      topup: { variant: "default", label: "Top-up" }
    };
    const config = variants[category] || { variant: "outline", label: category };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredFlow = data?.moneyFlow?.filter(flow => {
    if (filterType === "all") return true;
    if (filterType === "inflow") return flow.type === "inflow";
    if (filterType === "outflow") return flow.type === "outflow";
    return flow.category === filterType;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="inflow">Inflows Only</SelectItem>
              <SelectItem value="outflow">Outflows Only</SelectItem>
              <SelectItem value="payout">Payouts</SelectItem>
              <SelectItem value="instant_payout">Instant Payouts</SelectItem>
              <SelectItem value="refund">Refunds</SelectItem>
              <SelectItem value="card_spend">Card Spend</SelectItem>
              <SelectItem value="transfer">Transfers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Total Inflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(data?.summary?.totalInflow || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payments & top-ups received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Outflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(data?.summary?.totalOutflow || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payouts, refunds, transfers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Net Flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.summary?.netFlow || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(data?.summary?.netFlow || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.summary?.transactionCount || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Current Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((data?.balance?.available?.[0]?.amount || 0) / 100)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending: {formatCurrency((data?.balance?.pending?.[0]?.amount || 0) / 100)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Issuing Cards Alert */}
      {data?.issuing?.enabled && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-orange-500" />
              Stripe Issuing Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="font-medium">{data.issuing.cards.length}</span>
                <span className="text-muted-foreground ml-1">Cards</span>
              </div>
              <div>
                <span className="font-medium">{data.issuing.transactions}</span>
                <span className="text-muted-foreground ml-1">Transactions</span>
              </div>
              {data.issuing.pendingAuthorizations > 0 && (
                <Badge variant="destructive">
                  {data.issuing.pendingAuthorizations} Pending Auth
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flow by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Flow by Category</CardTitle>
          <CardDescription>Breakdown of money movement by type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data?.summary?.flowByCategory || {}).map(([category, stats]) => (
              <div key={category} className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryBadge(category)}
                </div>
                <div className="font-semibold">{formatCurrency(stats.amount)}</div>
                <div className="text-xs text-muted-foreground">{stats.count} transactions</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Destinations */}
      {Object.keys(data?.summary?.destinationAnalysis || {}).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Where Money Went (Top Destinations)
            </CardTitle>
            <CardDescription>Outbound money destinations analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data?.summary?.destinationAnalysis || {})
                .slice(0, 10)
                .map(([dest, stats]) => (
                  <div key={dest} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded max-w-[200px] truncate">
                        {dest}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {stats.type}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-red-500">
                        {formatCurrency(stats.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats.count} transfers
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Money Flow Timeline</CardTitle>
          <CardDescription>
            {filteredFlow.length} transactions in the last {days} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlow.map((flow) => (
                  <TableRow key={flow.id}>
                    <TableCell>
                      {getFlowIcon(flow.type, flow.category)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {getCategoryBadge(flow.category)}
                        </div>
                        <span className="text-xs text-muted-foreground max-w-[250px] truncate">
                          {flow.description}
                        </span>
                        {flow.metadata?.merchantName && (
                          <span className="text-xs font-medium">
                            {flow.metadata.merchantName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div className="text-muted-foreground">
                          From: <code className="bg-muted px-1 rounded">{flow.source}</code>
                        </div>
                        <div className="text-muted-foreground">
                          To: <code className="bg-muted px-1 rounded max-w-[150px] truncate inline-block">
                            {flow.destination}
                          </code>
                        </div>
                        {flow.traceId && (
                          <div className="text-muted-foreground">
                            Trace: <code className="bg-muted px-1 rounded text-[10px]">{flow.traceId.slice(0, 12)}...</code>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${flow.type === 'inflow' ? 'text-green-500' : 'text-red-500'}`}>
                        {flow.type === 'inflow' ? '+' : '-'}
                        {formatCurrency(flow.amount / 100, flow.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={flow.status === 'succeeded' || flow.status === 'paid' ? 'default' : 'secondary'}>
                        {flow.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(flow.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
