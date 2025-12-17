import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Banknote, 
  Calendar, 
  Clock, 
  RefreshCw, 
  Pause, 
  Play, 
  Send, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Building2,
  CreditCard,
  Settings,
  History,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Ban
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StripePayoutControlsTabProps {
  mode: "test" | "live";
}

interface PayoutSettings {
  account: {
    id: string;
    payouts_enabled: boolean;
    payout_schedule: {
      interval: "manual" | "daily" | "weekly" | "monthly";
      delay_days: number;
      weekly_anchor?: string;
      monthly_anchor?: number;
    };
    statement_descriptor: string;
    debit_negative_balances: boolean;
  };
  externalAccounts: Array<{
    id: string;
    object: string;
    bank_name: string;
    last4: string;
    routing_number: string;
    currency: string;
    country: string;
    default_for_currency: boolean;
    status: string;
  }>;
  balance: {
    available: Array<{ amount: number; currency: string }>;
    pending: Array<{ amount: number; currency: string }>;
    instant_available: Array<{ amount: number; currency: string }>;
  };
  recentPayouts: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    type: string;
    arrival_date: number;
    created: number;
    destination: string;
    automatic: boolean;
    failure_code: string | null;
    failure_message: string | null;
  }>;
  instantPayoutEligible: boolean;
  capabilities: Record<string, string>;
}

export function StripePayoutControlsTab({ mode }: StripePayoutControlsTabProps) {
  const queryClient = useQueryClient();
  const [showManualPayoutDialog, setShowManualPayoutDialog] = useState(false);
  const [manualPayoutAmount, setManualPayoutAmount] = useState("");
  const [manualPayoutMethod, setManualPayoutMethod] = useState<"standard" | "instant">("standard");
  const [manualPayoutDescription, setManualPayoutDescription] = useState("");
  
  const [scheduleInterval, setScheduleInterval] = useState<string>("daily");
  const [scheduleDelayDays, setScheduleDelayDays] = useState<string>("2");
  const [scheduleWeeklyAnchor, setScheduleWeeklyAnchor] = useState<string>("monday");

  // Fetch payout settings
  const { data: settings, isLoading, refetch } = useQuery<PayoutSettings>({
    queryKey: ["stripe-payout-settings", mode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payout-controls", {
        body: { action: "get-settings", mode },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });

  // Pause payouts mutation
  const pausePayoutsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payout-controls", {
        body: { action: "pause-payouts" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["stripe-payout-settings"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to pause payouts: ${error.message}`);
    },
  });

  // Resume payouts mutation
  const resumePayoutsMutation = useMutation({
    mutationFn: async (params: { interval: string; delay_days: number }) => {
      const { data, error } = await supabase.functions.invoke("stripe-payout-controls", {
        body: { action: "resume-payouts", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["stripe-payout-settings"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to resume payouts: ${error.message}`);
    },
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async (params: any) => {
      const { data, error } = await supabase.functions.invoke("stripe-payout-controls", {
        body: { action: "update-schedule", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Schedule updated successfully");
      queryClient.invalidateQueries({ queryKey: ["stripe-payout-settings"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });

  // Create manual payout mutation
  const createPayoutMutation = useMutation({
    mutationFn: async (params: { amount: number; method: string; description?: string }) => {
      const { data, error } = await supabase.functions.invoke("stripe-payout-controls", {
        body: { action: "create-payout", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setShowManualPayoutDialog(false);
      setManualPayoutAmount("");
      setManualPayoutDescription("");
      queryClient.invalidateQueries({ queryKey: ["stripe-payout-settings"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to create payout: ${error.message}`);
    },
  });

  // Cancel payout mutation
  const cancelPayoutMutation = useMutation({
    mutationFn: async (payout_id: string) => {
      const { data, error } = await supabase.functions.invoke("stripe-payout-controls", {
        body: { action: "cancel-payout", payout_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["stripe-payout-settings"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to cancel payout: ${error.message}`);
    },
  });

  const formatCurrency = (amount: number, currency = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_transit":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><TrendingUp className="h-3 w-3 mr-1" />In Transit</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "canceled":
        return <Badge variant="secondary"><Ban className="h-3 w-3 mr-1" />Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isPayoutsPaused = settings?.account?.payout_schedule?.interval === "manual";
  const availableBalance = settings?.balance?.available?.[0]?.amount || 0;
  const pendingBalance = settings?.balance?.pending?.[0]?.amount || 0;
  const instantAvailable = settings?.balance?.instant_available?.[0]?.amount || 0;
  const currency = settings?.balance?.available?.[0]?.currency || "usd";

  const handleCreatePayout = () => {
    const amount = Math.round(parseFloat(manualPayoutAmount) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    createPayoutMutation.mutate({
      amount,
      method: manualPayoutMethod,
      description: manualPayoutDescription || undefined,
    });
  };

  const handleUpdateSchedule = () => {
    const params: any = {
      interval: scheduleInterval,
      delay_days: parseInt(scheduleDelayDays),
    };
    if (scheduleInterval === "weekly") {
      params.weekly_anchor = scheduleWeeklyAnchor;
    }
    updateScheduleMutation.mutate(params);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="default" className="gap-1">
            <Banknote className="h-3 w-3" />
            Payout Controls
          </Badge>
          <Badge variant="outline" className="gap-1">
            {mode.toUpperCase()} Mode
          </Badge>
          {isPayoutsPaused && (
            <Badge variant="destructive" className="gap-1">
              <Pause className="h-3 w-3" />
              Payouts Paused
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Available Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(availableBalance, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Pending Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(pendingBalance, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              Instant Available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(instantAvailable, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {settings?.instantPayoutEligible ? "Instant payout ready" : "Not eligible"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Current Schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">
              {settings?.account?.payout_schedule?.interval || "Manual"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {settings?.account?.payout_schedule?.delay_days 
                ? `${settings.account.payout_schedule.delay_days} day delay`
                : "No auto-payouts"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Control your payout flow with one click
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Pause/Resume Toggle */}
            {isPayoutsPaused ? (
              <Button 
                onClick={() => resumePayoutsMutation.mutate({ interval: "daily", delay_days: 2 })}
                disabled={resumePayoutsMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {resumePayoutsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Resume Automatic Payouts
              </Button>
            ) : (
              <Button 
                onClick={() => pausePayoutsMutation.mutate()}
                disabled={pausePayoutsMutation.isPending}
                variant="destructive"
                className="gap-2"
              >
                {pausePayoutsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                Pause Automatic Payouts
              </Button>
            )}

            {/* Manual Payout Dialog */}
            <Dialog open={showManualPayoutDialog} onOpenChange={setShowManualPayoutDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  disabled={availableBalance <= 0}
                >
                  <Send className="h-4 w-4" />
                  Create Manual Payout
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Manual Payout</DialogTitle>
                  <DialogDescription>
                    Send funds to your bank account or debit card
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ({currency.toUpperCase()})</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualPayoutAmount}
                      onChange={(e) => setManualPayoutAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Available: {formatCurrency(availableBalance, currency)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Payout Method</Label>
                    <Select 
                      value={manualPayoutMethod} 
                      onValueChange={(v) => setManualPayoutMethod(v as "standard" | "instant")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Standard (1-2 business days)
                          </div>
                        </SelectItem>
                        <SelectItem 
                          value="instant" 
                          disabled={!settings?.instantPayoutEligible || instantAvailable <= 0}
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Instant (~30 minutes)
                            {!settings?.instantPayoutEligible && " (Not eligible)"}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      placeholder="e.g., Weekly withdrawal"
                      value={manualPayoutDescription}
                      onChange={(e) => setManualPayoutDescription(e.target.value)}
                    />
                  </div>

                  {manualPayoutMethod === "instant" && (
                    <Alert>
                      <Zap className="h-4 w-4" />
                      <AlertTitle>Instant Payout</AlertTitle>
                      <AlertDescription>
                        Instant payouts have an additional fee (typically 1% capped at $10).
                        Available for instant: {formatCurrency(instantAvailable, currency)}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowManualPayoutDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreatePayout}
                    disabled={createPayoutMutation.isPending || !manualPayoutAmount}
                  >
                    {createPayoutMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Create Payout
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payout Schedule Configuration
          </CardTitle>
          <CardDescription>
            Configure when automatic payouts are sent to your bank
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={scheduleInterval} onValueChange={setScheduleInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Only</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Delay (Business Days)</Label>
              <Select value={scheduleDelayDays} onValueChange={setScheduleDelayDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 days (Standard)</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="4">4 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleInterval === "weekly" && (
              <div className="space-y-2">
                <Label>Weekly Anchor Day</Label>
                <Select value={scheduleWeeklyAnchor} onValueChange={setScheduleWeeklyAnchor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="tuesday">Tuesday</SelectItem>
                    <SelectItem value="wednesday">Wednesday</SelectItem>
                    <SelectItem value="thursday">Thursday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button 
            onClick={handleUpdateSchedule}
            disabled={updateScheduleMutation.isPending}
            className="mt-4"
          >
            {updateScheduleMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Settings className="h-4 w-4 mr-2" />
            )}
            Update Schedule
          </Button>
        </CardContent>
      </Card>

      {/* Bank Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Payout Destinations
          </CardTitle>
          <CardDescription>
            Bank accounts and cards linked for payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings?.externalAccounts && settings.externalAccounts.length > 0 ? (
            <div className="space-y-3">
              {settings.externalAccounts.map((account) => (
                <div 
                  key={account.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {account.object === "bank_account" ? (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {account.bank_name || "Bank Account"} ****{account.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {account.currency.toUpperCase()} • {account.country}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.default_for_currency && (
                      <Badge variant="outline">Default</Badge>
                    )}
                    <Badge variant={account.status === "verified" ? "default" : "secondary"}>
                      {account.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No payout destinations</AlertTitle>
              <AlertDescription>
                Add a bank account in your Stripe Dashboard to receive payouts.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Payouts
          </CardTitle>
          <CardDescription>
            Last 10 payouts to your bank account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {settings?.recentPayouts && settings.recentPayouts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Arrival Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.recentPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-bold">
                        {formatCurrency(payout.amount, payout.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {payout.method === "instant" ? (
                            <Zap className="h-3 w-3 text-purple-500" />
                          ) : (
                            <Building2 className="h-3 w-3" />
                          )}
                          <span className="capitalize">{payout.method}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payout.automatic ? "Auto" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(payout.arrival_date)}
                      </TableCell>
                      <TableCell>
                        {payout.status === "pending" && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to cancel this payout?")) {
                                cancelPayoutMutation.mutate(payout.id);
                              }
                            }}
                            disabled={cancelPayoutMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {payout.failure_message && (
                          <span className="text-xs text-destructive" title={payout.failure_message}>
                            {payout.failure_code}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No recent payouts found
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Important Note</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Automatic payouts cannot be canceled once initiated</li>
            <li>Only <strong>pending</strong> manual payouts can be canceled</li>
            <li>Instant payouts incur additional fees (typically 1%)</li>
            <li>Schedule changes take effect for the next payout cycle</li>
            <li>Setting to "Manual" will stop all automatic payouts</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}


