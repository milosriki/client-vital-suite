import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { toast } from "sonner";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { AlertTriangle } from "lucide-react";

// API
import { dealsApi } from "@/features/sales-operations/api/dealsApi";

// Components
import { SalesFilters } from "@/components/sales-pipeline/SalesFilters";
import { SalesMetrics } from "@/components/sales-pipeline/SalesMetrics";
import { FunnelChart } from "@/components/sales-pipeline/FunnelChart";
import { CallStatusChart } from "@/components/sales-pipeline/CallStatusChart";
import { SalesTabs } from "@/components/sales-pipeline/SalesTabs";
import { DAYS_FILTER_OPTIONS } from "@/components/sales-pipeline/constants";
import { getFollowUpInsights } from "@/components/sales-pipeline/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnnounce } from "@/lib/accessibility";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { ActionIntercept } from "@/components/ui/action-intercept";
import { SalesPipelineGhost } from "@/components/sales-pipeline/SalesPipelineGhost";

export default function SalesPipeline() {
  const queryClient = useQueryClient();
  const [daysFilter, setDaysFilter] = useState<string>("3");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  // Calculate date filter
  const getDateFilter = () => {
    if (daysFilter === "all") return null;
    return subDays(new Date(), parseInt(daysFilter)).toISOString();
  };

  // Sync from HubSpot mutation
  const syncFromHubspot = useMutation({
    mutationFn: async (clearFakeData: boolean) => {
      const { data, error } = await supabase.functions.invoke(
        "sync-hubspot-to-supabase",
        {
          body: { clear_fake_data: clearFakeData, sync_type: "all" },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Synced ${data.contacts_synced} contacts, ${data.leads_synced} leads, ${data.deals_synced} deals, ${data.calls_synced} calls`,
      );
      // Refresh all queries
      queryClient.invalidateQueries({ queryKey: ["lead-funnel"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["deals-summary"] });
      queryClient.invalidateQueries({ queryKey: ["call-records"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
    },
    onError: (error: any) => {
      toast.error("Sync failed: " + error.message);
    },
  });

  // Update deal stage mutation (Mark Won / Mark Lost)
  const updateDealMutation = useMutation({
    mutationFn: dealsApi.updateDealStage,
    onMutate: async (newDeal) => {
      await queryClient.cancelQueries({ queryKey: ["deals-summary"] });
      const previousDeals = queryClient.getQueryData(["deals-summary"]);

      queryClient.setQueryData(["deals-summary"], (old: typeof dealsData) => {
        if (!old || !old.deals) return old;
        return {
          ...old,
          deals: old.deals.map((d) =>
            d.id === newDeal.dealId ? { ...d, stage: newDeal.stage } : d,
          ),
        };
      });

      return { previousDeals };
    },
    onError: (err, newDeal, context) => {
      toast.error("Failed to update deal stage");
      if (context?.previousDeals) {
        queryClient.setQueryData(["deals-summary"], context.previousDeals);
      }
    },
    onSuccess: (data) => {
      const stageName = data.stage === "closedwon" ? "Won" : "Lost";
      toast.success(`Deal marked as ${stageName}!`);
      queryClient.invalidateQueries({ queryKey: ["deals-summary"] });
      queryClient.invalidateQueries({ queryKey: ["lead-funnel"] });
      setSelectedDeal(null);
    },
  });

  // Real-time subscriptions for live updates
  useEffect(() => {
    const callsChannel = supabase
      .channel("calls-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_records" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["call-records"] });
        },
      )
      .subscribe();

    const leadsChannel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["lead-funnel"] });
        },
      )
      .subscribe();

    const dealsChannel = supabase
      .channel("deals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["deals-summary"] });
        },
      )
      .subscribe();

    const appointmentsChannel = supabase
      .channel("appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["appointments-summary"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(dealsChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, [queryClient]);

  // Fetch lead funnel data using the new dynamic_funnel_view
  const { data: funnelData, isLoading: funnelLoading } = useDedupedQuery({
    queryKey: ["lead-funnel", daysFilter, ownerFilter, campaignFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from("dynamic_funnel_view").select("*");

      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }
      if (ownerFilter !== "all") {
        query = query.eq("owner", ownerFilter);
      }
      if (campaignFilter !== "all") {
        query = query.eq("campaign", campaignFilter);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};

      data?.forEach((lead) => {
        const stage = lead.funnel_stage?.toLowerCase();
        statusCounts[stage] = (statusCounts[stage] || 0) + 1;
        const source = lead.lead_source || "direct";
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });

      return {
        leads: data || [],
        statusCounts,
        sourceCounts,
        total: data?.length || 0,
      };
    },
    staleTime: Infinity,
  });

  // Fetch Deep Payment History
  const { data: paymentHistory } = useDedupedQuery({
    queryKey: ["payment-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payment_history")
        .select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Fetch enhanced leads
  const { data: enhancedLeads } = useDedupedQuery({
    queryKey: ["enhanced-leads", daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from("enhanced_leads").select("*");
      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Real-time subscription handles updates
  });

  // Fetch contacts
  const { data: contacts } = useDedupedQuery({
    queryKey: ["contacts", daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from("contacts").select("*");
      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Real-time subscription handles updates
  });

  // Fetch deals data
  const { data: dealsData, isLoading: dealsLoading } = useDedupedQuery({
    queryKey: ["deals-summary", daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from("deals").select("*");
      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      const closedDeals = data?.filter((d) => d.status === "closed") || [];
      const totalValue = closedDeals.reduce(
        (sum, d) => sum + (d.deal_value || 0),
        0,
      );
      const totalCollected = closedDeals.reduce(
        (sum, d) => sum + (d.cash_collected || 0),
        0,
      );

      return {
        deals: data || [],
        closedCount: closedDeals.length,
        totalValue,
        totalCollected,
        avgDealValue: closedDeals.length ? totalValue / closedDeals.length : 0,
      };
    },
    staleTime: Infinity, // Real-time subscription handles updates
  });

  // Fetch call records
  const { data: callRecords } = useDedupedQuery({
    queryKey: ["call-records", daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from("call_records").select("*");
      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      // Group by status
      const statusCounts: Record<string, number> = {};
      data?.forEach((call) => {
        statusCounts[call.call_status] =
          (statusCounts[call.call_status] || 0) + 1;
      });

      return { calls: data || [], statusCounts, total: data?.length || 0 };
    },
    staleTime: Infinity, // Real-time subscription handles updates
  });

  // Fetch appointments
  const { data: appointments } = useDedupedQuery({
    queryKey: ["appointments-summary", daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from("appointments").select("*");
      if (dateFilter) {
        query = query.gte("scheduled_at", dateFilter);
      }
      const { data, error } = await query.order("scheduled_at", {
        ascending: false,
      });

      if (error) throw error;

      const scheduled =
        data?.filter((a) => a.status === "scheduled").length || 0;
      const completed =
        data?.filter((a) => a.status === "completed").length || 0;

      return { appointments: data || [], scheduled, completed };
    },
    staleTime: Infinity, // Real-time subscription handles updates
  });

  const allLeads = funnelData?.leads || [];

  // Extract unique owners and campaigns for filters
  const owners = useMemo(() => {
    const uniqueOwners = Array.from(
      new Set(allLeads.map((l: any) => l.owner).filter(Boolean)),
    );
    return (uniqueOwners as string[]).sort();
  }, [allLeads]);

  const campaigns = useMemo(() => {
    const uniqueCampaigns = Array.from(
      new Set(allLeads.map((l: any) => l.campaign).filter(Boolean)),
    );
    return (uniqueCampaigns as string[]).sort();
  }, [allLeads]);

  // Get follow-up insights - Memoized for performance
  const daysLabel =
    DAYS_FILTER_OPTIONS.find((o) => o.value === daysFilter)?.label ||
    daysFilter;

  const followUpInsights = useMemo(
    () =>
      getFollowUpInsights(
        allLeads,
        contacts || [],
        callRecords?.calls || [],
        dealsData?.deals || [],
        daysLabel,
      ),
    [allLeads, contacts, callRecords?.calls, dealsData?.deals, daysLabel],
  );

  const conversionRate = funnelData?.total
    ? (((dealsData?.closedCount || 0) / funnelData.total) * 100).toFixed(1)
    : "0.0";

  if (funnelLoading || dealsLoading) {
    return <SalesPipelineGhost />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-muted-foreground">
            Dynamic Funnel: Track leads from Ad click to Closed Won
          </p>
        </div>

        <SalesFilters
          daysFilter={daysFilter}
          setDaysFilter={setDaysFilter}
          ownerFilter={ownerFilter}
          setOwnerFilter={setOwnerFilter}
          campaignFilter={campaignFilter}
          setCampaignFilter={setCampaignFilter}
          owners={owners}
          campaigns={campaigns}
          syncFromHubspot={syncFromHubspot}
          DAYS_FILTER_OPTIONS={DAYS_FILTER_OPTIONS}
        />
      </div>

      {/* Action Required Banner - Compact */}
      {followUpInsights.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-red-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span className="font-semibold text-amber-400">
              Action Required
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
            {followUpInsights.slice(0, 4).map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                  insight.type === "urgent"
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : insight.type === "warning"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                }`}
              >
                <span className="font-bold">{insight.count}</span>
                <span className="text-xs opacity-80">
                  {insight.message
                    .replace(`${insight.count} `, "")
                    .split(" ")
                    .slice(0, 3)
                    .join(" ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top KPIs - Compact Grid */}
      <SalesMetrics
        funnelData={funnelData}
        contacts={contacts || []}
        callRecords={callRecords}
        dealsData={dealsData}
        allLeads={allLeads}
        paymentHistory={paymentHistory || []}
        conversionRate={conversionRate}
      />

      {/* Lead Funnel */}
      <FunnelChart funnelData={funnelData} />

      {/* Call Status Overview */}
      <CallStatusChart callRecords={callRecords} />

      <SalesTabs
        funnelData={funnelData}
        enhancedLeads={enhancedLeads || []}
        contacts={contacts || []}
        dealsData={dealsData}
        callRecords={callRecords}
        appointments={appointments}
        allLeads={allLeads}
        onDealClick={(deal) => setSelectedDeal(deal)}
      />

      <Sheet
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
      >
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selectedDeal && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle className="text-2xl">
                  {selectedDeal.deal_name}
                </SheetTitle>
                <SheetDescription>
                  Deal ID: {selectedDeal.id?.slice(0, 8)}...
                </SheetDescription>
              </SheetHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-slate-50 border">
                    <p className="text-sm font-medium text-muted-foreground">
                      Value
                    </p>
                    <p className="text-2xl font-bold">
                      AED {selectedDeal.amount?.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border">
                    <p className="text-sm font-medium text-muted-foreground">
                      Stage
                    </p>
                    <Badge
                      variant="outline"
                      className="mt-1 capitalize text-base"
                    >
                      {selectedDeal.stage}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Contact Info</h3>
                  <div className="p-4 rounded-lg border bg-white space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">
                        Unknown (Sync Pending)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Close Date:</span>
                      <span className="font-medium">
                        {selectedDeal.close_date
                          ? new Date(
                              selectedDeal.close_date,
                            ).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <ActionIntercept
                    trigger={
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        <DollarSign className="mr-2 h-4 w-4" />
                        Mark Won
                      </Button>
                    }
                    title="Mark Deal as Won?"
                    description={
                      <div className="space-y-2">
                        <p>
                          This will move the deal to <strong>Closed Won</strong>{" "}
                          stage and update your revenue metrics.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Are you sure you want to proceed?
                        </p>
                      </div>
                    }
                    variant="success"
                    confirmText="Confirm Won"
                    onConfirm={() => {
                      updateDealMutation.mutate({
                        dealId: selectedDeal.id,
                        stage: "closedwon",
                      });
                    }}
                  />

                  <ActionIntercept
                    trigger={
                      <Button
                        variant="outline"
                        className="w-full text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Mark Lost
                      </Button>
                    }
                    title="Mark Deal as Lost?"
                    description={
                      <div className="space-y-2">
                        <p>
                          This will move the deal to{" "}
                          <strong>Closed Lost</strong> stage.
                        </p>
                        <p className="text-sm text-red-600 font-medium bg-red-50 p-2 rounded">
                          ⚠️ This action cannot be easily undone.
                        </p>
                      </div>
                    }
                    variant="danger"
                    confirmText="Confirm Lost"
                    onConfirm={() => {
                      toast.success(
                        `Deal ${selectedDeal.deal_name} marked as Lost.`,
                      );
                      // In a real app, you would call a mutation here
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
