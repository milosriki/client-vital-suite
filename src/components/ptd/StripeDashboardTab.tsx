import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  CreditCard, 
  DollarSign, 
  Users, 
  TrendingUp, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Wallet,
  ArrowUpRight,
  Clock,
  Shield,
  Bot,
  Maximize2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StripeAIDashboard from "./StripeAIDashboard";

interface StripeDashboardTabProps {
  mode: "test" | "live";
}

interface StripeData {
  balance: {
    available: { amount: number; currency: string }[];
    pending: { amount: number; currency: string }[];
  } | null;
  customers: any[];
  subscriptions: any[];
  payments: any[];
  products: any[];
  invoices: any[];
  account: any | null;
}

export default function StripeDashboardTab({ mode }: StripeDashboardTabProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAIDashboard, setShowAIDashboard] = useState(false);

  const { data: stripeData, isLoading, refetch, isError } = useQuery({
    queryKey: ['stripe-dashboard-data', mode],
    queryFn: async (): Promise<StripeData> => {
      const { data, error } = await supabase.functions.invoke('stripe-dashboard-data', {
        body: { mode }
      });
      
      if (error) throw error;
      setIsConnected(true);
      return data;
    },
    enabled: isConnected,
    refetchInterval: 30000,
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-dashboard-data', {
        body: { mode }
      });
      
      if (error) throw error;
      
      setIsConnected(true);
      toast.success("Connected to Stripe successfully!");
      refetch();
    } catch (error: any) {
      toast.error("Failed to connect to Stripe: " + error.message);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      active: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      succeeded: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      paid: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      canceled: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      pending: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
      incomplete: { variant: "outline", icon: <AlertCircle className="h-3 w-3" /> },
    };
    
    const config = statusConfig[status] || { variant: "outline" as const, icon: null };
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  // Calculate metrics
  const totalAvailable = stripeData?.balance?.available?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const totalPending = stripeData?.balance?.pending?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const activeSubscriptions = stripeData?.subscriptions?.filter(s => s.status === 'active').length || 0;
  const totalCustomers = stripeData?.customers?.length || 0;
  const recentPayments = stripeData?.payments?.slice(0, 10) || [];

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="p-6 rounded-full bg-primary/10">
          <CreditCard className="h-16 w-16 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Connect to Stripe</h2>
          <p className="text-muted-foreground max-w-md">
            Click the button below to connect and view your Stripe data including balance, 
            customers, subscriptions, payments, and more.
          </p>
        </div>
        <Button 
          size="lg" 
          onClick={handleConnect} 
          disabled={isConnecting}
          className="gap-2"
        >
          {isConnecting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Connect Stripe Smart
            </>
          )}
        </Button>
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" />
          Mode: {mode.toUpperCase()}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Dashboard Modal */}
      <StripeAIDashboard 
        open={showAIDashboard} 
        onOpenChange={setShowAIDashboard} 
        mode={mode} 
      />

      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
            {isConnected ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            {mode.toUpperCase()} Mode
          </Badge>
          {stripeData?.account?.business_profile?.name && (
            <Badge variant="secondary">
              {stripeData.account.business_profile.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowAIDashboard(true)}
            className="gap-2"
          >
            <Bot className="h-4 w-4" />
            <Maximize2 className="h-4 w-4" />
            Payouts AI Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              Available Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalAvailable, 'usd')}
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
              Pending Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(totalPending, 'usd')}
                </span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Total Customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold">{totalCustomers}</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Active Subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold text-primary">{activeSubscriptions}</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recent Payments
          </CardTitle>
          <CardDescription>Last 10 payment intents</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">{payment.id.slice(0, 20)}...</TableCell>
                    <TableCell>{payment.customer || 'Guest'}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(payment.created * 1000).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">No recent payments</p>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions & Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : stripeData?.subscriptions?.length ? (
              <div className="space-y-3">
                {stripeData.subscriptions.slice(0, 5).map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{sub.customer}</p>
                      <p className="text-sm text-muted-foreground font-mono">{sub.id.slice(0, 20)}...</p>
                    </div>
                    {getStatusBadge(sub.status)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No subscriptions</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : stripeData?.products?.length ? (
              <div className="space-y-3">
                {stripeData.products.slice(0, 5).map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.description || 'No description'}</p>
                    </div>
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No products</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recent Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : stripeData?.customers?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stripeData.customers.slice(0, 10).map((customer: any) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name || 'N/A'}</TableCell>
                    <TableCell>{customer.email || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(customer.created * 1000).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">No customers</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
