import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// Components & Hooks
import { useHubSpotRealtime } from "@/components/hubspot-live/hooks/useHubSpotRealtime";
import { HubSpotKPIs } from "@/components/hubspot-live/HubSpotKPIs";
import { HubSpotFilters } from "@/components/hubspot-live/HubSpotFilters";
import { HubSpotTabs } from "@/components/hubspot-live/HubSpotTabs";

const HubSpotLiveData = () => {
  const [timeframe, setTimeframe] = useState("all_time");

  const {
    kpis,
    allLeads,
    dealsData,
    callsData,
    staffData,
    isLoading,
    refreshData,
    dateRange,
  } = useHubSpotRealtime(timeframe);

  const handleRefresh = async () => {
    toast.info("Refreshing data from database...");
    await refreshData();
    toast.success("Data refreshed!");
  };

  const handleClearFakeData = async () => {
    if (
      !confirm(
        "This will delete all test/fake data (emails ending with @email.com or @example.com) and sync fresh data from HubSpot. Continue?",
      )
    ) {
      return;
    }
    toast.info("Clearing fake data and syncing from HubSpot...");
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-hubspot-to-supabase",
        {
          body: { clear_fake_data: true, sync_type: "all" },
        },
      );
      if (error) throw error;
      toast.success(
        `Synced ${data.contacts_synced} contacts, ${data.leads_synced} leads, ${data.deals_synced} deals`,
      );
      await refreshData();
    } catch (err: any) {
      toast.error("Sync failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            HubSpot Live Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Real-time metrics from your database • Formula-driven KPIs
          </p>
        </div>
      </div>

      {/* Filters */}
      <HubSpotFilters
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        onClearFakeData={handleClearFakeData}
      />

      {/* KPI Formula Cards */}
      <HubSpotKPIs kpis={kpis} />

      {/* Main Content Tabs */}
      <HubSpotTabs
        kpis={kpis}
        isLoading={isLoading}
        allLeads={allLeads}
        callsData={callsData || []}
        dealsData={dealsData || []}
        staffData={staffData || []}
      />

      {/* Data Source Info */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Database-Backed Dashboard</AlertTitle>
        <AlertDescription>
          Data from: leads ({allLeads.length}), deals ({dealsData?.length || 0}
          ), call_records ({callsData?.length || 0}). Timeframe:{" "}
          {format(dateRange.start, "MMM dd")} -{" "}
          {format(dateRange.end, "MMM dd, yyyy")}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default HubSpotLiveData;
