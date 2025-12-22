import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Building2, 
  RefreshCw, 
  Send, 
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  Ban,
  Calendar,
  Download,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { subMonths } from "date-fns";

interface OutboundTransfer {
  id: string;
  amount: number;
  currency: string;
  status: string;
  destination_payment_method: string;
  created: number;
  expected_arrival_date?: number;
  description?: string;
  statement_descriptor?: string;
}

export function StripeTreasuryTab() {
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [allTransfers, setAllTransfers] = useState<OutboundTransfer[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Form state
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [destinationMethod, setDestinationMethod] = useState("");
  const [description, setDescription] = useState("");

  // Calculate 12 months ago timestamp
  const twelveMonthsAgo = Math.floor(subMonths(new Date(), 12).getTime() / 1000);

  // Fetch Financial Accounts
  const { data: accounts, isLoading: accountsLoading } = useDedupedQuery({
    queryKey: ["stripe-treasury-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-treasury", {
        body: { action: "list-financial-accounts" },
      });
      if (error) throw error;
      return data.accounts || [];
    },
  });

  // Set default account
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts, selectedAccount]);

  // Reset transfers when account changes
  useEffect(() => {
    setAllTransfers([]);
    setHasMore(true);
  }, [selectedAccount]);

  // Fetch all transfers for last 12 months with pagination
  const fetchAllTransfers = async () => {
    if (!selectedAccount) return;
    
    setIsLoadingMore(true);
    let fetchedTransfers: OutboundTransfer[] = [];
    let startingAfter: string | undefined = undefined;
    let keepFetching = true;

    try {
      while (keepFetching) {
        const { data, error } = await supabase.functions.invoke("stripe-treasury", {
          body: { 
            action: "list-outbound-transfers",
            financial_account: selectedAccount,
            limit: 100,
            starting_after: startingAfter,
            created: { gte: twelveMonthsAgo }
          },
        });

        if (error) throw error;

        const transfers = data.transfers || [];
        fetchedTransfers = [...fetchedTransfers, ...transfers];

        if (!data.has_more || transfers.length === 0) {
          keepFetching = false;
          setHasMore(false);
        } else {
          startingAfter = transfers[transfers.length - 1].id;
        }

        // Safety limit - prevent infinite loops
        if (fetchedTransfers.length > 1000) {
          keepFetching = false;
        }
      }

      setAllTransfers(fetchedTransfers);
      toast.success(`Loaded ${fetchedTransfers.length} transfers from last 12 months`);
    } catch (error) {
      console.error("Error fetching transfers:", error);
      toast.error("Failed to load transfers");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Initial fetch
  const { isLoading: transfersLoading, refetch: refetchTransfers } = useDedupedQuery({
    queryKey: ["stripe-treasury-transfers", selectedAccount],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await supabase.functions.invoke("stripe-treasury", {
        body: { 
          action: "list-outbound-transfers",
          financial_account: selectedAccount,
          limit: 100,
          created: { gte: twelveMonthsAgo }
        },
      });
      if (error) throw error;
      setAllTransfers(data.transfers || []);
      setHasMore(data.has_more || false);
      return data.transfers || [];
    },
    enabled: !!selectedAccount,
  });

  // Create Transfer Mutation
  const createTransferMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-treasury", {
        body: { 
          action: "create-outbound-transfer",
          amount: Math.round(parseFloat(amount) * 100),
          currency,
          financial_account: selectedAccount,
          destination_payment_method: destinationMethod,
          description
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Transfer initiated successfully");
      setShowCreateDialog(false);
      setAmount("");
      setDescription("");
      refetchTransfers();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create transfer: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Posted</Badge>;
      case "processing":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "canceled":
        return <Badge variant="secondary"><Ban className="h-3 w-3 mr-1" />Canceled</Badge>;
      case "returned":
        return <Badge variant="destructive"><ArrowUpRight className="h-3 w-3 mr-1" />Returned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Calculate stats
  const stats = {
    total: allTransfers.length,
    totalAmount: allTransfers.reduce((sum, t) => sum + t.amount, 0),
    posted: allTransfers.filter(t => t.status === "posted").length,
    processing: allTransfers.filter(t => t.status === "processing").length,
    failed: allTransfers.filter(t => t.status === "failed" || t.status === "returned").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Treasury Outbound Transfers</h2>
          {accountsLoading ? (
            <Skeleton className="h-10 w-[200px]" />
          ) : (
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[250px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select Financial Account" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((acc: { id: string; supported_currencies?: string[] }) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.id} ({acc.supported_currencies?.join(", ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchTransfers()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button disabled={!selectedAccount}>
                <Send className="h-4 w-4 mr-2" />
                New Transfer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Outbound Transfer</DialogTitle>
                <DialogDescription>
                  Send funds from your Treasury account to an external destination.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD</SelectItem>
                        <SelectItem value="eur">EUR</SelectItem>
                        <SelectItem value="gbp">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Destination Payment Method ID</Label>
                  <Input
                    placeholder="pm_..."
                    value={destinationMethod}
                    onChange={(e) => setDestinationMethod(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the ID of the PaymentMethod to send funds to.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Transfer description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button 
                  onClick={() => createTransferMutation.mutate()}
                  disabled={createTransferMutation.isPending || !amount || !destinationMethod}
                >
                  {createTransferMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  Create Transfer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transfers</CardTitle>
          <CardDescription>
            History of outbound transfers from {selectedAccount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {transfersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : transfers && transfers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Arrival Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((transfer: any) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-bold font-mono">
                        {formatCurrency(transfer.amount, transfer.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {transfer.destination_payment_method}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(transfer.created * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {transfer.expected_arrival_date 
                          ? new Date(transfer.expected_arrival_date * 1000).toLocaleDateString() 
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mb-4 opacity-20" />
                <p>No transfers found for this account</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
