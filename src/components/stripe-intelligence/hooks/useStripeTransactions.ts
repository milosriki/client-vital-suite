import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface StripeTransaction {
  id: string;
  stripe_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  description: string | null;
  created_at: string;
  contact_id: string | null;
  customer_id: string | null;
  metadata: any;
}

export interface StripeMetrics {
  totalRevenue: number;
  totalRefunded: number;
  netRevenue: number;
  successfulPaymentsCount: number;
  failedPaymentsCount: number;
  pendingPaymentsCount: number;
  refundedPaymentsCount: number;
  successRate: number;
  currency: string;
}

export interface ChartDataPoint {
  date: string;
  revenue: number;
  count: number;
  refunds: number;
}

export const useStripeTransactions = (
  dateRange: DateRange,
  statusFilter: string,
) => {
  // Fetch stripe transactions with date range and status filter
  const {
    data: transactions,
    isLoading,
    refetch,
    isRefetching,
  } = useDedupedQuery({
    queryKey: [
      "stripe-transactions",
      dateRange.from?.toISOString(),
      dateRange.to?.toISOString(),
      statusFilter,
    ],
    queryFn: async () => {
      let query = supabase
        .from("stripe_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply date range filter
      if (dateRange.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange.to) {
        // Add one day to include the end date
        const endDate = new Date(dateRange.to);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt("created_at", endDate.toISOString());
      }

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as StripeTransaction[];
    },
    staleTime: 60000, // 1 minute
  });

  // Calculate metrics from transactions
  const metrics: StripeMetrics = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalRevenue: 0,
        totalRefunded: 0,
        netRevenue: 0,
        successfulPaymentsCount: 0,
        failedPaymentsCount: 0,
        pendingPaymentsCount: 0,
        refundedPaymentsCount: 0,
        successRate: 100,
        currency: "aed",
      };
    }

    const successfulTransactions = transactions.filter(
      (t) => t.status === "succeeded" || t.status === "paid",
    );
    const failedTransactions = transactions.filter(
      (t) =>
        t.status === "failed" ||
        t.status === "canceled" ||
        t.status === "requires_payment_method",
    );
    const pendingTransactions = transactions.filter(
      (t) =>
        t.status === "pending" ||
        t.status === "processing" ||
        t.status === "requires_action",
    );
    const refundedTransactions = transactions.filter(
      (t) => t.status === "refunded" || t.status === "partially_refunded",
    );

    const totalRevenue = successfulTransactions.reduce(
      (sum, t) => sum + (Number(t.amount) || 0),
      0,
    );
    const totalRefunded = refundedTransactions.reduce(
      (sum, t) => sum + Math.abs(Number(t.amount) || 0),
      0,
    );
    const netRevenue = totalRevenue - totalRefunded;

    const successRate =
      transactions.length > 0
        ? Math.round((successfulTransactions.length / transactions.length) * 100)
        : 100;

    // Get the most common currency (default to AED)
    const currencyMap = new Map<string, number>();
    transactions.forEach((t) => {
      const curr = (t.currency || "aed").toLowerCase();
      currencyMap.set(curr, (currencyMap.get(curr) || 0) + 1);
    });
    const currency =
      Array.from(currencyMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "aed";

    return {
      totalRevenue,
      totalRefunded,
      netRevenue,
      successfulPaymentsCount: successfulTransactions.length,
      failedPaymentsCount: failedTransactions.length,
      pendingPaymentsCount: pendingTransactions.length,
      refundedPaymentsCount: refundedTransactions.length,
      successRate,
      currency,
    };
  }, [transactions]);

  // Calculate chart data (daily breakdown)
  const chartData: ChartDataPoint[] = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    const dailyMap = new Map<
      string,
      { revenue: number; count: number; refunds: number }
    >();

    transactions.forEach((t) => {
      const date = t.created_at.split("T")[0]; // Get YYYY-MM-DD
      const existing = dailyMap.get(date) || {
        revenue: 0,
        count: 0,
        refunds: 0,
      };

      if (t.status === "succeeded" || t.status === "paid") {
        existing.revenue += Number(t.amount) || 0;
        existing.count += 1;
      } else if (
        t.status === "refunded" ||
        t.status === "partially_refunded"
      ) {
        existing.refunds += Math.abs(Number(t.amount) || 0);
      }

      dailyMap.set(date, existing);
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // Status breakdown for pie chart
  const statusBreakdown = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    const statusMap = new Map<string, number>();
    transactions.forEach((t) => {
      const status = t.status || "unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries())
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
        value,
        color:
          name === "succeeded" || name === "paid"
            ? "hsl(var(--success))"
            : name === "failed" || name === "canceled"
              ? "hsl(var(--destructive))"
              : name === "refunded" || name === "partially_refunded"
                ? "hsl(var(--warning))"
                : "hsl(var(--muted))",
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Recent transactions (top 20 for display)
  const recentTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.slice(0, 20);
  }, [transactions]);

  return {
    transactions: transactions || [],
    recentTransactions,
    metrics,
    chartData,
    statusBreakdown,
    isLoading,
    refetch,
    isRefetching,
  };
};

// Import React for useMemo
import React from "react";
