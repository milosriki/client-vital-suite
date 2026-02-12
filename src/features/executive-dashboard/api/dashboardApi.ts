import { supabase } from "@/integrations/supabase/client";
import { useSuspenseQuery } from "@tanstack/react-query";

// Types
export interface DashboardMetrics {
  totalVolume: number;
  totalRefunded: number;
  activeSubscriptions: number;
  successRate: number;
  netRevenue: number;
  mrr: number;
  payingCustomerCount: number;
}

export interface AWSHealthData {
  totalSessions: number;
  totalLifetimeRevenue: number;
  lastSync: string | null;
  count: number;
  healthScore: number;
}

// Keys
export const dashboardKeys = {
  all: ["executive-dashboard"] as const,
  stripe: (range: { from: string; to: string }) =>
    [...dashboardKeys.all, "stripe", range] as const,
  ultimate: () => [...dashboardKeys.all, "ultimate"] as const,
  leads: (range: { from: string; to: string }) =>
    [...dashboardKeys.all, "leads", range] as const,
  awsTruth: () => [...dashboardKeys.all, "aws-truth"] as const,
};

// API
export const dashboardApi = {
  getStripeData: async (dateRange: { from: Date; to: Date }) => {
    const { data, error } = await supabase.functions.invoke(
      "stripe-dashboard-data",
      {
        body: {
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
        },
      },
    );
    if (error) throw error;
    return data?.metrics as DashboardMetrics;
  },

  getUltimateData: async () => {
    const { data, error } = await supabase.functions.invoke(
      "ultimate-aggregator",
    );
    if (error) throw error;
    return data;
  },

  getLeadsCount: async (dateRange: { from: Date; to: Date }) => {
    const { count, error } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("lifecycle_stage", "lead")
      .gte("created_at", dateRange.from.toISOString());

    if (error) throw error;
    return count || 0;
  },

  getAWSTruth: async () => {
    const { data, error } = await supabase
      .from("aws_truth_cache")
      .select("outstanding_sessions, lifetime_revenue, updated_at");

    if (error) throw error;

    const totalSessions = data.reduce(
      (sum, row) => sum + (row.outstanding_sessions || 0),
      0,
    );
    const totalLifetimeRevenue = data.reduce(
      (sum, row) => sum + (row.lifetime_revenue || 0),
      0,
    );
    const lastSync = data.length > 0 ? data[0].updated_at : null;

    // Health Score logic
    const activeClients = data.filter(
      (r) => (r.outstanding_sessions || 0) > 0,
    ).length;
    const healthScore =
      data.length > 0 ? Math.round((activeClients / data.length) * 100) : 0;

    return {
      totalSessions,
      totalLifetimeRevenue,
      lastSync,
      count: data.length,
      healthScore,
    } as AWSHealthData;
  },
};
