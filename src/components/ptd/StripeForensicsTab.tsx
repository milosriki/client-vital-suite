import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Shield, 
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  CreditCard,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Activity,
  Webhook,
  FileWarning,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  Scale,
  ArrowLeftRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeMoneyFlowTab } from "./StripeMoneyFlowTab";
import { StripeCompleteIntelligence } from "./StripeCompleteIntelligence";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface StripeForensicsTabProps {
  mode: "test" | "live";
}

interface Anomaly {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  details: any;
}

interface ForensicsData {
  balance: any;
  payouts: any[];
  balanceTransactions: any[];
  payments: any[];
  refunds: any[];
  charges: any[];
  transfers: any[];
  events: any[];
  sensitiveEvents: any[];
  webhookEndpoints: any[];
  disputes: any[];
  recentCustomers: any[];
  account: any;
  anomalies: Anomaly[];
  securityScore: number;
  auditTimestamp: string;
}

export default function StripeForensicsTab({ mode }: StripeForensicsTabProps) {
  const [isAuditing, setIsAuditing] = useState(false);

  const { data: forensicsData, isLoading, refetch, isError, isFetching } = useDedupedQuery({
    queryKey: ['stripe-forensics', mode],
    queryFn: async (): Promise<ForensicsData> => {
      console.log('[Forensics] Fetching fresh data...');
      const { data, error } = await supabase.functions.invoke('stripe-forensics', {
        body: { action: 'full-audit', mode }
      });
      if (error) throw error;
      console.log('[Forensics] Data received:', data?.auditTimestamp);
      return data;
    },
    staleTime: 0, // Always consider data stale - fetch fresh every time
    gcTime: 0, // Don't cache
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await refetch();
      if (result.data) {
        toast.success(`Audit completed! Data as of ${new Date(result.data.auditTimestamp).toLocaleTimeString()}`);
      }
    } catch (error: any) {
      toast.error("Audit failed: " + error.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const formatCurrency = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Critical';
  };

  // Calculate metrics
  const totalAvailable = forensicsData?.balance?.available?.reduce((sum: number, b: any) => sum + b.amount, 0) || 0;
  const totalPending = forensicsData?.balance?.pending?.reduce((sum: number, b: any) => sum + b.amount, 0) || 0;
  const totalPayouts = forensicsData?.payouts?.reduce((sum: number, p: any) => p.status === 'paid' ? sum + p.amount : sum, 0) || 0;
  const totalRevenue = forensicsData?.payments?.reduce((sum: number, p: any) => p.status === 'succeeded' ? sum + p.amount : sum, 0) || 0;
  const totalRefunds = forensicsData?.refunds?.reduce((sum: number, r: any) => sum + r.amount, 0) || 0;

  if (!forensicsData && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="p-6 rounded-full bg-primary/10">
          <Shield className="h-16 w-16 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Stripe Security Forensics</h2>
          <p className="text-muted-foreground max-w-md">
            Run a comprehensive security audit to detect unauthorized activity, suspicious patterns, 
            and potential fraud in your Stripe account.
          </p>
        </div>
        <Button 
          size="lg" 
          onClick={handleRunAudit} 
          disabled={isAuditing}
          className="gap-2"
        >
          {isAuditing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Running Audit...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Run Security Audit
            </>
          )}
        </Button>
        <Badge variant="outline" className="gap-1">
          <Eye className="h-3 w-3" />
          Mode: {mode.toUpperCase()}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="default" className="gap-1">
            <Shield className="h-3 w-3" />
            Forensics Active
          </Badge>
          <Badge variant="outline" className="gap-1">
            {mode.toUpperCase()} Mode
          </Badge>
          {forensicsData?.auditTimestamp && (
            <span className="text-xs text-muted-foreground">
              Last audit: {new Date(forensicsData.auditTimestamp).toLocaleString()}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRunAudit} disabled={isAuditing || isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isAuditing || isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Fetching...' : 'Refresh Now'}
        </Button>
      </div>

      {/* Security Score Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Score
            </span>
            {isLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <span className={`text-4xl font-bold ${getScoreColor(forensicsData?.securityScore || 0)}`}>
                {forensicsData?.securityScore || 0}/100
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <span className={getScoreColor(forensicsData?.securityScore || 0)}>
                {getScoreLabel(forensicsData?.securityScore || 0)} - {forensicsData?.anomalies?.length || 0} issues detected
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-4 w-full" />
          ) : (
            <Progress value={forensicsData?.securityScore || 0} className="h-3" />
          )}
        </CardContent>
      </Card>

      {/* Anomalies Section */}
      {forensicsData?.anomalies && forensicsData.anomalies.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Security Alerts ({forensicsData.anomalies.length})
            </CardTitle>
            <CardDescription>Issues that require your immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {forensicsData.anomalies.map((anomaly, i) => (
                <div key={i} className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(anomaly.severity)}>
                        {anomaly.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{anomaly.type.replace(/_/g, ' ')}</span>
                    </div>
                    {anomaly.severity === 'critical' && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{anomaly.message}</p>
                  <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                    {JSON.stringify(anomaly.details, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Available Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(totalAvailable)}
                </span>
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-bold text-yellow-600">
                {formatCurrency(totalPending)}
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              30d Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-bold text-primary">
                {formatCurrency(totalRevenue)}
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Banknote className="h-4 w-4" />
              30d Payouts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-bold">
                {formatCurrency(totalPayouts)}
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ArrowDownRight className="h-4 w-4" />
              30d Refunds
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-bold text-destructive">
                {formatCurrency(totalRefunds)}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="complete-intel" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="complete-intel" className="gap-1">
            <Shield className="h-4 w-4" />
            Full Intel
          </TabsTrigger>
          <TabsTrigger value="money-flow" className="gap-1">
            <ArrowLeftRight className="h-4 w-4" />
            Money Flow
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1">
            <Activity className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1">
            <Banknote className="h-4 w-4" />
            Payouts
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="refunds" className="gap-1">
            <Scale className="h-4 w-4" />
            Refunds
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="disputes" className="gap-1">
            <FileWarning className="h-4 w-4" />
            Disputes
          </TabsTrigger>
        </TabsList>

        {/* Complete Intelligence Tab */}
        <TabsContent value="complete-intel">
          <StripeCompleteIntelligence mode={mode} />
        </TabsContent>

        {/* Money Flow Tab */}
        <TabsContent value="money-flow">
          <StripeMoneyFlowTab mode={mode} />
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Events (7 Days)
                </span>
                <Badge variant="outline">
                  {forensicsData?.events?.length || 0} events
                </Badge>
              </CardTitle>
              <CardDescription>All Stripe events including sensitive operations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : forensicsData?.events?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forensicsData.events.map((event: any) => (
                        <TableRow key={event.id} className={
                          event.type.includes('payout') || event.type.includes('transfer') || event.type.includes('bank_account')
                            ? 'bg-yellow-500/10' : ''
                        }>
                          <TableCell className="font-mono text-xs">
                            {event.type.includes('payout') || event.type.includes('transfer') ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {event.type}
                              </Badge>
                            ) : (
                              event.type
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(event.created * 1000).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{event.id.slice(0, 20)}...</TableCell>
                          <TableCell>
                            {event.pending_webhooks > 0 ? (
                              <Badge variant="outline">Pending</Badge>
                            ) : (
                              <Badge variant="secondary">Delivered</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No events found</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Payout History (30 Days)
              </CardTitle>
              <CardDescription>Monitor all money leaving your account</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : forensicsData?.payouts?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Arrival Date</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forensicsData.payouts.map((payout: any) => (
                        <TableRow key={payout.id}>
                          <TableCell className="font-bold">
                            {formatCurrency(payout.amount, payout.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>
                              {payout.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(payout.arrival_date * 1000).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            ****{payout.destination?.last4 || 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{payout.id.slice(0, 15)}...</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No payouts found</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Intents (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : forensicsData?.payments?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forensicsData.payments.slice(0, 50).map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-bold">
                            {formatCurrency(payment.amount, payment.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={payment.status === 'succeeded' ? 'default' : 'destructive'}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.customer || 'Guest'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(payment.created * 1000).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{payment.id.slice(0, 15)}...</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No payments found</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Refunds (30 Days)
              </CardTitle>
              <CardDescription>Watch for unusual refund patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : forensicsData?.refunds?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Charge</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forensicsData.refunds.map((refund: any) => (
                        <TableRow key={refund.id} className={refund.amount > 50000 ? 'bg-destructive/10' : ''}>
                          <TableCell className={`font-bold ${refund.amount > 50000 ? 'text-destructive' : ''}`}>
                            {formatCurrency(refund.amount, refund.currency)}
                            {refund.amount > 50000 && <AlertTriangle className="inline h-4 w-4 ml-1" />}
                          </TableCell>
                          <TableCell>
                            <Badge variant={refund.status === 'succeeded' ? 'default' : 'secondary'}>
                              {refund.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {refund.reason || 'Not specified'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{refund.charge?.slice(0, 15) || 'N/A'}...</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(refund.created * 1000).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No refunds found</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Endpoints
              </CardTitle>
              <CardDescription>Check for unauthorized webhook destinations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : forensicsData?.webhookEndpoints?.length ? (
                <div className="space-y-4">
                  {forensicsData.webhookEndpoints.map((wh: any) => {
                    const isSuspicious = !wh.url.includes('supabase') && !wh.url.includes('ptd') && !wh.url.includes('lovable');
                    return (
                      <div key={wh.id} className={`p-4 rounded-lg border ${isSuspicious ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <code className="text-sm font-mono">{wh.url}</code>
                          {isSuspicious ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              SUSPICIOUS
                            </Badge>
                          ) : (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{wh.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Events: {wh.enabled_events?.length || 0}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No webhooks configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes Tab */}
        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5" />
                Disputes & Chargebacks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : forensicsData?.disputes?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Due By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forensicsData.disputes.map((dispute: any) => (
                      <TableRow key={dispute.id} className={
                        dispute.status === 'needs_response' ? 'bg-destructive/10' : ''
                      }>
                        <TableCell className="font-bold">
                          {formatCurrency(dispute.amount, dispute.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={dispute.status === 'needs_response' ? 'destructive' : 'secondary'}>
                            {dispute.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{dispute.reason}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {dispute.evidence_details?.due_by 
                            ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString()
                            : 'N/A'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">No disputes - Great!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}