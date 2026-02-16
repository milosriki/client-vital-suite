import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowDownLeft, ArrowUpRight, RefreshCw, TrendingUp, TrendingDown,
  CreditCard, Building2, Wallet, AlertTriangle, DollarSign,
  Shield, Terminal, Landmark, Users, Activity, Eye
} from "lucide-react";
import { toast } from "sonner";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface StripeCompleteIntelligenceProps {
  mode?: "test" | "live";
}

export function StripeCompleteIntelligence({ mode = "live" }: StripeCompleteIntelligenceProps) {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch, isRefetching } = useDedupedQuery({
    queryKey: ["stripe-complete-intelligence", mode, days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-forensics", {
        body: { action: "complete-intelligence", days }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000
  });

  const formatCurrency = (amount: number, currency = "aed") => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Complete Stripe Intelligence</h2>
          <Badge variant={data?.securityScore >= 80 ? "default" : data?.securityScore >= 50 ? "secondary" : "destructive"}>
            Security: {data?.securityScore || 0}/100
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Total Inflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-500">
              {formatCurrency(data?.summary?.totalInflow || 0)}
            </div>
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
            <div className="text-xl font-bold text-red-500">
              {formatCurrency(data?.summary?.totalOutflow || 0)}
            </div>
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
            <div className={`text-xl font-bold ${(data?.summary?.netFlow || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(data?.summary?.netFlow || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency((data?.balance?.available?.[0]?.amount || 0) / 100)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data?.summary?.transactionCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies Alert */}
      {data?.anomalies?.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {data.anomalies.length} Anomalies Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.anomalies.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === 'critical' ? 'destructive' : a.severity === 'high' ? 'secondary' : 'outline'}>
                      {a.severity}
                    </Badge>
                    <span className="text-sm">{a.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="flow" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="flow" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Money Flow
          </TabsTrigger>
          <TabsTrigger value="issuing" className="flex items-center gap-1">
            <CreditCard className="h-4 w-4" />
            Issuing
            {data?.issuing?.enabled && <Badge variant="secondary" className="ml-1 text-xs">{data.issuing.cards.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="treasury" className="flex items-center gap-1">
            <Landmark className="h-4 w-4" />
            Treasury
            {data?.treasury?.enabled && <Badge variant="secondary" className="ml-1 text-xs">{data.treasury.financialAccounts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="terminal" className="flex items-center gap-1">
            <Terminal className="h-4 w-4" />
            Terminal
            {data?.terminal?.enabled && <Badge variant="secondary" className="ml-1 text-xs">{data.terminal.readers.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="destinations" className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            Destinations
          </TabsTrigger>
          <TabsTrigger value="disputes" className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Disputes
            {data?.disputes?.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{data.disputes.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Money Flow Tab */}
        <TabsContent value="flow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flow by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(data?.summary?.flowByCategory || {}).map(([category, stats]: [string, any]) => (
                  <div key={category} className="p-3 rounded-lg bg-muted/50">
                    <Badge variant="outline" className="mb-2">{category}</Badge>
                    <div className="font-semibold">{formatCurrency(stats.amount)}</div>
                    <div className="text-xs text-muted-foreground">{stats.count} transactions</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction Timeline</CardTitle>
              <CardDescription>{data?.moneyFlow?.length || 0} transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>From → To</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.moneyFlow || []).slice(0, 100).map((flow: any) => (
                      <TableRow key={flow.id}>
                        <TableCell>
                          {flow.type === 'inflow' ? 
                            <ArrowDownLeft className="h-4 w-4 text-green-500" /> : 
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{flow.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{flow.source}</div>
                          <div className="text-muted-foreground">→ {flow.destination}</div>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${flow.type === 'inflow' ? 'text-green-500' : 'text-red-500'}`}>
                          {flow.type === 'inflow' ? '+' : '-'}{formatCurrency(flow.amount / 100, flow.currency)}
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
        </TabsContent>

        {/* Issuing Tab */}
        <TabsContent value="issuing" className="space-y-4">
          {!data?.issuing?.enabled ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Stripe Issuing not enabled on this account</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Cards</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{data.issuing.cards.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Cardholders</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{data.issuing.cardholders.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Transactions</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{data.issuing.transactions.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Total Spend</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-red-500">{formatCurrency(data.issuing.totalSpend / 100)}</div></CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Issued Cards</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Card</TableHead>
                          <TableHead>Cardholder</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expires</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.issuing.cards.map((card: any) => (
                          <TableRow key={card.id}>
                            <TableCell className="font-mono">•••• {card.last4}</TableCell>
                            <TableCell>{card.cardholderName || '-'}</TableCell>
                            <TableCell><Badge variant="outline">{card.type}</Badge></TableCell>
                            <TableCell>
                              <Badge variant={card.status === 'active' ? 'default' : 'secondary'}>{card.status}</Badge>
                            </TableCell>
                            <TableCell>{card.expMonth}/{card.expYear}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Card Transactions (Where Money Went)</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Card</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.issuing.transactions.map((txn: any) => (
                          <TableRow key={txn.id}>
                            <TableCell className="font-medium">{txn.merchantName || 'Unknown'}</TableCell>
                            <TableCell><Badge variant="outline">{txn.merchantCategory}</Badge></TableCell>
                            <TableCell className="text-xs">{txn.merchantCity}, {txn.merchantCountry}</TableCell>
                            <TableCell className="text-right font-medium text-red-500">
                              {formatCurrency(Math.abs(txn.amount) / 100, txn.currency)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">•••• {txn.cardLast4}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Treasury Tab */}
        <TabsContent value="treasury" className="space-y-4">
          {!data?.treasury?.enabled ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Stripe Treasury not enabled on this account</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Financial Accounts</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{data.treasury.financialAccounts.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Total Balance</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{formatCurrency(data.treasury.totalBalance / 100)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Inbound Transfers</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-green-500">{data.treasury.inboundTransfers.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Outbound Transfers</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-red-500">{data.treasury.outboundTransfers.length}</div></CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Financial Accounts</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.treasury.financialAccounts.map((fa: any) => (
                      <div key={fa.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <code className="text-sm">{fa.id}</code>
                          <Badge variant={fa.status === 'open' ? 'default' : 'secondary'}>{fa.status}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Cash:</span>
                            <span className="ml-2 font-medium">{formatCurrency((fa.balance?.cash?.usd || 0) / 100)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pending:</span>
                            <span className="ml-2 font-medium">{formatCurrency((fa.balance?.inbound_pending?.usd || 0) / 100)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Features:</span>
                            <span className="ml-2">{fa.activeFeatures?.join(', ') || 'None'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Terminal Tab */}
        <TabsContent value="terminal" className="space-y-4">
          {!data?.terminal?.enabled ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Stripe Terminal not enabled on this account</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Readers</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{data.terminal.readers.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Locations</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{data.terminal.locations.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Configurations</CardDescription></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{data.terminal.configurations.length}</div></CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Terminal Readers</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Device</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Last Seen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.terminal.readers.map((reader: any) => (
                          <TableRow key={reader.id}>
                            <TableCell className="font-medium">{reader.label || reader.id}</TableCell>
                            <TableCell><Badge variant="outline">{reader.deviceType}</Badge></TableCell>
                            <TableCell>
                              <Badge variant={reader.status === 'online' ? 'default' : 'secondary'}>{reader.status}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{reader.ipAddress || '-'}</TableCell>
                            <TableCell className="text-xs">
                              {reader.lastSeenAt ? formatDate(reader.lastSeenAt) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Destinations Tab */}
        <TabsContent value="destinations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Where Money Went (Top Destinations)
              </CardTitle>
              <CardDescription>All outbound money destinations tracked</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {Object.entries(data?.summary?.destinationAnalysis || {}).map(([dest, stats]: [string, any]) => (
                    <div key={dest} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-[250px] truncate">{dest}</code>
                        <Badge variant="outline">{stats.type}</Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-red-500">{formatCurrency(stats.amount)}</div>
                        <div className="text-xs text-muted-foreground">{stats.count} transfers</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes Tab */}
        <TabsContent value="disputes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Disputes & Chargebacks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.disputes || []).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No disputes found</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.disputes.map((dispute: any) => (
                        <TableRow key={dispute.id}>
                          <TableCell className="font-mono text-xs">{dispute.id}</TableCell>
                          <TableCell className="font-medium text-red-500">
                            {formatCurrency(dispute.amount / 100, dispute.currency)}
                          </TableCell>
                          <TableCell><Badge variant="outline">{dispute.reason}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={dispute.status === 'won' ? 'default' : dispute.status === 'lost' ? 'destructive' : 'secondary'}>
                              {dispute.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(dispute.created)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}