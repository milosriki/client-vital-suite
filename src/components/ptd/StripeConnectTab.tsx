import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Shield,
  Wallet,
  ArrowUpRight,
  ArrowRightLeft,
  ExternalLink,
  Building,
  Clock,
  Banknote,
  Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StripeConnectTabProps {
  mode: "test" | "live";
}

interface ConnectDashboardData {
  summary: {
    total_accounts: number;
    enabled_accounts: number;
    transfers_30d: number;
    total_transferred_30d: number;
    platform_available: number;
    platform_pending: number;
  };
  accounts: any[];
  recent_transfers: any[];
  account_balances: any[];
  platform_balance: any;
}

export default function StripeConnectTab({ mode }: StripeConnectTabProps) {
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showCreateTransfer, setShowCreateTransfer] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading, refetch, isError, error } = useQuery({
    queryKey: ['stripe-connect', mode],
    queryFn: async (): Promise<ConnectDashboardData> => {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'dashboard' }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const createAccountMutation = useMutation({
    mutationFn: async (accountData: any) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'create-account', data: accountData }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Connected account created! ID: " + data.account.id);
      setShowCreateAccount(false);
      queryClient.invalidateQueries({ queryKey: ['stripe-connect'] });
    },
    onError: (error: any) => {
      toast.error("Failed to create account: " + error.message);
    }
  });

  const createOnboardingLinkMutation = useMutation({
    mutationFn: async (data: { account_id: string }) => {
      const { data: result, error } = await supabase.functions.invoke('stripe-connect', {
        body: { 
          action: 'create-onboarding-link', 
          data: {
            account_id: data.account_id,
            refresh_url: window.location.href,
            return_url: window.location.href
          }
        }
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      window.open(data.url, '_blank');
    },
    onError: (error: any) => {
      toast.error("Failed to create onboarding link: " + error.message);
    }
  });

  const createTransferMutation = useMutation({
    mutationFn: async (transferData: any) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: { action: 'create-transfer', data: transferData }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Transfer created successfully!");
      setShowCreateTransfer(false);
      queryClient.invalidateQueries({ queryKey: ['stripe-connect'] });
    },
    onError: (error: any) => {
      toast.error("Failed to create transfer: " + error.message);
    }
  });

  const formatCurrency = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getAccountStatusBadge = (account: any) => {
    if (account.charges_enabled && account.payouts_enabled) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Enabled
        </Badge>
      );
    } else if (account.charges_enabled || account.payouts_enabled) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Partially Enabled
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
  };

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="p-6 rounded-full bg-destructive/10">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error Loading Connect Data</h2>
          <p className="text-muted-foreground max-w-md">{errorMessage}</p>
        </div>
        <Button onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" />
          Mode: {mode.toUpperCase()}
        </Badge>
      </div>
    );
  }

  if (!dashboardData && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="p-6 rounded-full bg-primary/10">
          <Users className="h-16 w-16 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Stripe Connect</h2>
          <p className="text-muted-foreground max-w-md">
            Manage connected accounts, transfers, and platform payments. Enable your marketplace or platform to accept and distribute payments.
          </p>
        </div>
        <Button size="lg" onClick={() => refetch()} className="gap-2">
          <Users className="h-4 w-4" />
          Load Connect Dashboard
        </Button>
      </div>
    );
  }

  const summary = dashboardData?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="default" className="gap-1">
            <Globe className="h-3 w-3" />
            Connect Active
          </Badge>
          <Badge variant="outline" className="gap-1">
            {mode.toUpperCase()} Mode
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateAccount} onOpenChange={setShowCreateAccount}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Connected Account</DialogTitle>
                <DialogDescription>Add a new connected account to your platform</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createAccountMutation.mutate({
                  type: formData.get('type'),
                  country: formData.get('country'),
                  email: formData.get('email'),
                  business_type: formData.get('business_type')
                });
              }}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Account Type</Label>
                      <Select name="type" defaultValue="express">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="express">Express</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select name="country" defaultValue="US">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                          <SelectItem value="DE">Germany</SelectItem>
                          <SelectItem value="FR">France</SelectItem>
                          <SelectItem value="AU">Australia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_type">Business Type</Label>
                    <Select name="business_type" defaultValue="individual">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="non_profit">Non-Profit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createAccountMutation.isPending}>
                    {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCreateTransfer} onOpenChange={setShowCreateTransfer}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Transfer</DialogTitle>
                <DialogDescription>Transfer funds to a connected account</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createTransferMutation.mutate({
                  amount: Number(formData.get('amount')) * 100,
                  currency: 'usd',
                  destination: formData.get('destination'),
                  description: formData.get('description')
                });
              }}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="destination">Destination Account</Label>
                    <Select name="destination">
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboardData?.accounts?.filter((a: any) => a.payouts_enabled).map((acc: any) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.email || acc.business_profile?.name || acc.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input id="description" name="description" placeholder="Transfer description" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createTransferMutation.isPending}>
                    {createTransferMutation.isPending ? "Creating..." : "Create Transfer"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Connected Accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{summary?.total_accounts || 0}</span>
                <span className="text-xs text-muted-foreground">
                  ({summary?.enabled_accounts || 0} enabled)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ArrowRightLeft className="h-4 w-4" />
              30d Transfers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold">{summary?.transfers_30d || 0}</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              Platform Available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary?.platform_available || 0)}
                </span>
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Total Transferred
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(summary?.total_transferred_30d || 0)}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Accounts, Transfers, Balances */}
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="accounts" className="gap-1">
            <Building className="h-4 w-4" />
            Accounts ({summary?.total_accounts || 0})
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-1">
            <ArrowRightLeft className="h-4 w-4" />
            Transfers
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-1">
            <Banknote className="h-4 w-4" />
            Balances
          </TabsTrigger>
        </TabsList>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Connected Accounts
              </CardTitle>
              <CardDescription>
                Manage your marketplace or platform connected accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : dashboardData?.accounts?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.accounts.map((acc: any) => (
                        <TableRow key={acc.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{acc.business_profile?.name || acc.email || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground font-mono">{acc.id.slice(0, 20)}...</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{acc.type}</Badge>
                          </TableCell>
                          <TableCell>{acc.country}</TableCell>
                          <TableCell>{getAccountStatusBadge(acc)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {!acc.charges_enabled && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => createOnboardingLinkMutation.mutate({ account_id: acc.id })}
                                  disabled={createOnboardingLinkMutation.isPending}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Building className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No connected accounts yet</p>
                    <Button className="mt-4" onClick={() => setShowCreateAccount(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Account
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfers Tab */}
        <TabsContent value="transfers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Recent Transfers (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : dashboardData?.recent_transfers?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.recent_transfers.map((transfer: any) => (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-bold">
                            {formatCurrency(transfer.amount, transfer.currency)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {transfer.destination.slice(0, 15)}...
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {transfer.description || "No description"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(transfer.created * 1000).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No transfers yet</p>
                    <Button className="mt-4" onClick={() => setShowCreateTransfer(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Transfer
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances">
          <div className="grid gap-4">
            {/* Platform Balance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Platform Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(dashboardData?.platform_balance?.available?.[0]?.amount || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {formatCurrency(dashboardData?.platform_balance?.pending?.[0]?.amount || 0)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connected Account Balances */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Account Balances
                </CardTitle>
                <CardDescription>Balances for top connected accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {isLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : dashboardData?.account_balances?.length ? (
                    <div className="space-y-4">
                      {dashboardData.account_balances.map((ab: any) => (
                        <div key={ab.account_id} className="p-4 rounded-lg bg-muted/50 border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">{ab.email || ab.account_id}</p>
                            <Badge variant="outline" className="font-mono text-xs">
                              {ab.account_id.slice(0, 12)}...
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Available: </span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(ab.available?.[0]?.amount || 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pending: </span>
                              <span className="font-medium text-yellow-600">
                                {formatCurrency(ab.pending?.[0]?.amount || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No account balances available</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
