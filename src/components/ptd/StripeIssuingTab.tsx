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
  CreditCard,
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Clock,
  Shield,
  Wallet,
  ArrowUpRight,
  Activity,
  PauseCircle,
  PlayCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StripeIssuingTabProps {
  mode: "test" | "live";
}

interface IssuingDashboardData {
  summary: {
    total_cardholders: number;
    total_cards: number;
    active_cards: number;
    virtual_cards: number;
    physical_cards: number;
    pending_authorizations: number;
    total_spend_30d: number;
    transactions_30d: number;
  };
  cardholders: any[];
  cards: any[];
  recent_transactions: any[];
  pending_authorizations: any[];
}

export default function StripeIssuingTab({ mode }: StripeIssuingTabProps) {
  const [showCreateCardholder, setShowCreateCardholder] = useState(false);
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [selectedCardholder, setSelectedCardholder] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading, refetch, isError, error } = useQuery({
    queryKey: ['stripe-issuing', mode],
    queryFn: async (): Promise<IssuingDashboardData> => {
      const { data, error } = await supabase.functions.invoke('stripe-issuing', {
        body: { action: 'dashboard' }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const createCardholderMutation = useMutation({
    mutationFn: async (cardholderData: any) => {
      const { data, error } = await supabase.functions.invoke('stripe-issuing', {
        body: { action: 'create-cardholder', data: cardholderData }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Cardholder created successfully!");
      setShowCreateCardholder(false);
      queryClient.invalidateQueries({ queryKey: ['stripe-issuing'] });
    },
    onError: (error: any) => {
      toast.error("Failed to create cardholder: " + error.message);
    }
  });

  const createCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const { data, error } = await supabase.functions.invoke('stripe-issuing', {
        body: { action: 'create-card', data: cardData }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Card created successfully!");
      setShowCreateCard(false);
      queryClient.invalidateQueries({ queryKey: ['stripe-issuing'] });
    },
    onError: (error: any) => {
      toast.error("Failed to create card: " + error.message);
    }
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ card_id, status }: { card_id: string; status: string }) => {
      const { data, error } = await supabase.functions.invoke('stripe-issuing', {
        body: { action: 'update-card', data: { card_id, status } }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Card updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['stripe-issuing'] });
    },
    onError: (error: any) => {
      toast.error("Failed to update card: " + error.message);
    }
  });

  const formatCurrency = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(Math.abs(amount) / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      active: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      inactive: { variant: "secondary", icon: <PauseCircle className="h-3 w-3" /> },
      canceled: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      pending: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
    };
    const config = statusConfig[status] || { variant: "outline" as const, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isIssuingNotEnabled = errorMessage.includes("not enabled") || errorMessage.includes("not available");
    
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="p-6 rounded-full bg-destructive/10">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            {isIssuingNotEnabled ? "Stripe Issuing Not Enabled" : "Error Loading Issuing Data"}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {isIssuingNotEnabled 
              ? "Stripe Issuing is not enabled for this account. Please contact Stripe to enable Issuing capabilities."
              : errorMessage}
          </p>
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
          <CreditCard className="h-16 w-16 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Stripe Issuing</h2>
          <p className="text-muted-foreground max-w-md">
            Issue and manage virtual and physical cards. Control spending, monitor transactions, and manage cardholders.
          </p>
        </div>
        <Button size="lg" onClick={() => refetch()} className="gap-2">
          <CreditCard className="h-4 w-4" />
          Load Issuing Dashboard
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
            <CreditCard className="h-3 w-3" />
            Issuing Active
          </Badge>
          <Badge variant="outline" className="gap-1">
            {mode.toUpperCase()} Mode
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateCardholder} onOpenChange={setShowCreateCardholder}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Cardholder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Cardholder</DialogTitle>
                <DialogDescription>Add a new cardholder to issue cards to</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createCardholderMutation.mutate({
                  name: formData.get('name'),
                  email: formData.get('email'),
                  type: formData.get('type'),
                  billing: {
                    address: {
                      line1: formData.get('address_line1'),
                      city: formData.get('city'),
                      state: formData.get('state'),
                      postal_code: formData.get('postal_code'),
                      country: formData.get('country') || 'US'
                    }
                  }
                });
              }}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" name="name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select name="type" defaultValue="individual">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_line1">Address</Label>
                    <Input id="address_line1" name="address_line1" required />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" name="city" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" name="state" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Zip Code</Label>
                      <Input id="postal_code" name="postal_code" required />
                    </div>
                  </div>
                  <input type="hidden" name="country" value="US" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createCardholderMutation.isPending}>
                    {createCardholderMutation.isPending ? "Creating..." : "Create Cardholder"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCreateCard} onOpenChange={setShowCreateCard}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Issue Card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue New Card</DialogTitle>
                <DialogDescription>Create a virtual or physical card</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createCardMutation.mutate({
                  cardholder_id: formData.get('cardholder_id'),
                  type: formData.get('card_type'),
                  currency: 'usd',
                  spending_controls: {
                    spending_limits: [{
                      amount: Number(formData.get('spending_limit')) * 100,
                      interval: formData.get('limit_interval')
                    }]
                  }
                });
              }}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardholder_id">Cardholder</Label>
                    <Select name="cardholder_id" value={selectedCardholder} onValueChange={setSelectedCardholder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a cardholder" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboardData?.cardholders?.map((ch: any) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            {ch.name} ({ch.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card_type">Card Type</Label>
                    <Select name="card_type" defaultValue="virtual">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="virtual">Virtual Card</SelectItem>
                        <SelectItem value="physical">Physical Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="spending_limit">Spending Limit ($)</Label>
                      <Input id="spending_limit" name="spending_limit" type="number" defaultValue="1000" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limit_interval">Interval</Label>
                      <Select name="limit_interval" defaultValue="monthly">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_authorization">Per Transaction</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createCardMutation.isPending || !selectedCardholder}>
                    {createCardMutation.isPending ? "Creating..." : "Issue Card"}
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
              Cardholders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold">{summary?.total_cardholders || 0}</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              Cards Issued
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{summary?.total_cards || 0}</span>
                <span className="text-xs text-muted-foreground">
                  ({summary?.active_cards || 0} active)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              30d Spend
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(summary?.total_spend_30d || 0)}
                </span>
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold">{summary?.transactions_30d || 0}</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Authorizations Alert */}
      {(summary?.pending_authorizations || 0) > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              Pending Authorizations ({summary?.pending_authorizations})
            </CardTitle>
            <CardDescription>Authorizations awaiting response</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboardData?.pending_authorizations?.map((auth: any) => (
                  <TableRow key={auth.id}>
                    <TableCell className="font-bold">
                      {formatCurrency(auth.amount, auth.currency)}
                    </TableCell>
                    <TableCell>{auth.merchant_data?.name || "Unknown"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(auth.created * 1000).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Cards, Cardholders, Transactions */}
      <Tabs defaultValue="cards" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cards" className="gap-1">
            <CreditCard className="h-4 w-4" />
            Cards ({summary?.total_cards || 0})
          </TabsTrigger>
          <TabsTrigger value="cardholders" className="gap-1">
            <Users className="h-4 w-4" />
            Cardholders ({summary?.total_cardholders || 0})
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1">
            <Activity className="h-4 w-4" />
            Transactions
          </TabsTrigger>
        </TabsList>

        {/* Cards Tab */}
        <TabsContent value="cards">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Issued Cards
                </span>
                <div className="flex gap-2 text-sm font-normal">
                  <Badge variant="outline">Virtual: {summary?.virtual_cards || 0}</Badge>
                  <Badge variant="outline">Physical: {summary?.physical_cards || 0}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : dashboardData?.cards?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Card</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cardholder</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.cards.map((card: any) => (
                        <TableRow key={card.id}>
                          <TableCell className="font-mono">
                            •••• {card.last4}
                            <span className="text-xs text-muted-foreground ml-2">
                              {card.exp_month}/{card.exp_year}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {card.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(card.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {typeof card.cardholder === 'string' ? card.cardholder.slice(0, 15) + '...' : card.cardholder?.name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {card.status === 'active' ? (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => updateCardMutation.mutate({ card_id: card.id, status: 'inactive' })}
                                  disabled={updateCardMutation.isPending}
                                >
                                  <PauseCircle className="h-4 w-4 text-yellow-600" />
                                </Button>
                              ) : card.status === 'inactive' ? (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => updateCardMutation.mutate({ card_id: card.id, status: 'active' })}
                                  disabled={updateCardMutation.isPending}
                                >
                                  <PlayCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No cards issued yet</p>
                    <Button className="mt-4" onClick={() => setShowCreateCard(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Issue First Card
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cardholders Tab */}
        <TabsContent value="cardholders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Cardholders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : dashboardData?.cardholders?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.cardholders.map((ch: any) => (
                        <TableRow key={ch.id}>
                          <TableCell className="font-medium">{ch.name}</TableCell>
                          <TableCell>{ch.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{ch.type}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(ch.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No cardholders yet</p>
                    <Button className="mt-4" onClick={() => setShowCreateCardholder(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Cardholder
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : dashboardData?.recent_transactions?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.recent_transactions.map((tx: any) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-bold">
                            {formatCurrency(tx.amount, tx.currency)}
                          </TableCell>
                          <TableCell>{tx.merchant_data?.name || "Unknown"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {tx.merchant_data?.category || "N/A"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(tx.created * 1000).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
