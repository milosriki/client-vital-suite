import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { formatDealStage } from "@/lib/stage-mapping";

// ============================================================================
// Tab 2: Pipeline Data Hook
// ============================================================================

export interface PipelineStageData {
  stage: string;
  count: number;
  total_value: number;
}

export interface PipelineDeal {
  id: string;
  deal_name: string | null;
  stage: string | null;
  deal_value: number;
  owner_name: string | null;
  created_at: string | null;
  status: string | null;
}

export function usePipelineData(dateRange: string) {
  return useQuery({
    queryKey: ["pipeline-data", dateRange],
    queryFn: async () => {
      // Fetch deals grouped by stage for stage breakdown
      const { data: deals, error } = await supabase
        .from("deals")
        .select("id, deal_name, stage, stage_label, deal_value, amount, owner_name, created_at, status, close_date")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate metrics
      const stages = deals?.reduce((acc, deal) => {
        const stage = deal.stage || "Unknown";
        if (!acc[stage]) {
          acc[stage] = { stage, count: 0, total_value: 0 };
        }
        acc[stage].count++;
        acc[stage].total_value += Number(deal.deal_value) || Number(deal.amount) || 0;
        return acc;
      }, {} as Record<string, PipelineStageData>);

      const stageBreakdown = Object.values(stages || {});

      // Calculate total pipeline value
      const totalPipeline = deals?.reduce((sum, deal) => sum + (Number(deal.deal_value) || Number(deal.amount) || 0), 0) || 0;

      // Calculate weighted pipeline (using stage probability - simplified)
      const stageProbabilities: Record<string, number> = {
        "qualifiedtobuy": 0.25,
        "decisionmakerboughtin": 0.3,
        "122178070": 0.4,
        "122237508": 0.5,
        "contractsent": 0.75,
        "closedwon": 1.0,
        "closedlost": 0,
      };
      const weightedPipeline = deals?.reduce((sum, deal) => {
        const probability = stageProbabilities[deal.stage || ""] || 0.3;
        return sum + (Number(deal.deal_value) || Number(deal.amount) || 0) * probability;
      }, 0) || 0;

      // Calculate close rate
      const closedWon = deals?.filter(d => d.stage === "closedwon").length || 0;
      const total = deals?.length || 1;
      const closeRate = (closedWon / total) * 100;

      // Calculate average deal value
      const avgDealValue = totalPipeline / (total || 1);

      // Calculate average time in pipeline (velocity)
      const completedDeals = deals?.filter(d => d.close_date) || [];
      const avgVelocity = completedDeals.reduce((sum, deal) => {
        const created = new Date(deal.created_at || "");
        const closed = new Date(deal.close_date || "");
        const days = Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / (completedDeals.length || 1);

      // Get active deals for table
      const activeDeals = deals
        ?.filter(d => d.stage !== "closedlost" && d.stage !== "closedwon")
        .slice(0, 10)
        .map(deal => {
          const daysInStage = deal.created_at
            ? Math.floor((Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return {
            company: deal.deal_name || "Unknown",
            stage: formatDealStage(deal.stage),
            value: deal.deal_value,
            owner: deal.owner_name || "Unassigned",
            days: daysInStage,
            next: daysInStage > 30 ? "🔴 Follow-up" : daysInStage > 14 ? "🟡 Check-in" : "✅ On track",
          };
        }) || [];

      // Calculate conversion funnel data — using real HubSpot stage IDs
      const funnelStages = [
        { id: "decisionmakerboughtin", name: "Called - Follow up" },
        { id: "qualifiedtobuy", name: "Assessment Scheduled" },
        { id: "122237508", name: "Assessment Confirmed" },
        { id: "2900542", name: "Assessment Done" },
        { id: "contractsent", name: "Waiting Decision" },
        { id: "closedwon", name: "Closed Won" },
      ];
      const funnelData = funnelStages.map(({ id, name }) => {
        const count = deals?.filter(d => d.stage === id).length || 0;
        const total = deals?.length || 1;
        const percentage = ((count / total) * 100).toFixed(1);
        return {
          name,
          value: count,
          label: `${count} (${percentage}%)`,
        };
      });

      // Calculate time in stage
      const timeInStage = stageBreakdown.map(s => ({
        stage: s.stage,
        days: Math.floor(Math.random() * 20) + 5, // TODO: Calculate from actual data
      }));

      return {
        metrics: {
          totalPipeline,
          weightedPipeline,
          closeRate,
          avgDealValue,
          avgVelocity,
        },
        stageBreakdown,
        funnelData,
        timeInStage,
        activeDeals,
      };
    },
  });
}

// ============================================================================
// Tab 3: HubSpot Health Data Hook
// ============================================================================

export interface SyncError {
  id: string;
  error_type: string;
  error_message: string;
  source: string;
  created_at: string | null;
  resolved_at: string | null;
}

export interface LifecycleData {
  name: string;
  value: number;
  percentage: number;
}

export function useHubSpotHealth(dateRange: string) {
  return useQuery({
    queryKey: ["hubspot-health", dateRange],
    queryFn: async () => {
      // Fetch sync errors
      const { data: syncErrors, error: syncError } = await supabase
        .from("sync_errors")
        .select("id, error_type, error_message, source, created_at, resolved_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (syncError) throw syncError;

      // Fetch contacts for lifecycle distribution
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, lifecycle_stage, email");

      if (contactsError) throw contactsError;

      // Calculate lifecycle distribution
      const lifecycleMap = contacts?.reduce((acc, contact) => {
        const stage = contact.lifecycle_stage || "Unknown";
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalContacts = contacts?.length || 1;
      const lifecycleDistribution: LifecycleData[] = Object.entries(lifecycleMap || {})
        .map(([name, value]) => ({
          name,
          value,
          percentage: Math.round((value / totalContacts) * 100),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Count metrics
      const totalSyncErrors = syncErrors?.length || 0;
      const unresolvedErrors = syncErrors?.filter(e => !e.resolved_at).length || 0;
      const contactsWithoutEmail = contacts?.filter(c => !c.email).length || 0;

      // Get deals count
      const { count: dealsCount } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true });

      // Get companies count (from contacts with company_id)
      const companiesCount = new Set(
        contacts?.filter(c => c.company_id).map(c => c.company_id)
      ).size;

      return {
        metrics: {
          contacts: totalContacts,
          deals: dealsCount || 0,
          companies: companiesCount,
          syncErrors: unresolvedErrors,
        },
        syncErrors: syncErrors || [],
        lifecycleDistribution,
        dataQuality: {
          contactsWithoutEmail,
          duplicateCompanies: 0, // TODO: Calculate from actual data
          orphanedDeals: 0, // TODO: Calculate from actual data
        },
      };
    },
  });
}

// ============================================================================
// Tab 4: Live Data Hook with Realtime Subscriptions
// ============================================================================

export interface LiveActivity {
  time: string;
  event: string;
  type: "contact" | "deal" | "lifecycle" | "alert" | "email";
}

export function useLiveData() {
  const [liveActivity, setLiveActivity] = useState<LiveActivity[]>([]);

  // Fetch initial recent activity
  const { data: recentData, refetch } = useQuery({
    queryKey: ["live-data"],
    queryFn: async () => {
      // Fetch recent contacts (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: recentContacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, created_at, attribution_source")
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: recentDeals } = await supabase
        .from("deals")
        .select("id, deal_name, stage, deal_value, owner_name, created_at, contact_id")
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(10);

      // Format as activity stream
      const activities: LiveActivity[] = [];

      recentContacts?.forEach(contact => {
        const timeAgo = getTimeAgo(contact.created_at || "");
        const name = `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown";
        const source = contact.attribution_source || "Direct";
        activities.push({
          time: timeAgo,
          event: `New contact: ${name} (${source})`,
          type: "contact",
        });
      });

      recentDeals?.forEach(deal => {
        const timeAgo = getTimeAgo(deal.created_at || "");
        activities.push({
          time: timeAgo,
          event: `Deal "${deal.deal_name}" created in ${deal.stage} ($${deal.deal_value.toLocaleString()})`,
          type: "deal",
        });
      });

      // Sort by most recent
      activities.sort((a, b) => {
        const aTime = parseTimeAgo(a.time);
        const bTime = parseTimeAgo(b.time);
        return aTime - bTime;
      });

      return {
        liveActivity: activities.slice(0, 10),
        recentDeals: recentDeals || [],
        todayActivity: {
          newContacts: recentContacts?.length || 0,
          newDeals: recentDeals?.length || 0,
          emailsSent: 0, // TODO: Add emails table
          callsLogged: 0, // TODO: Add calls table
          tasksCreated: 0, // TODO: Add tasks table
        },
      };
    },
  });

  // Set up realtime subscriptions
  useEffect(() => {
    let contactsChannel: RealtimeChannel | null = null;
    let dealsChannel: RealtimeChannel | null = null;

    // Subscribe to contacts changes
    contactsChannel = supabase
      .channel("contacts-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts" },
        (payload) => {
          const newContact = payload.new as any;
          const name = `${newContact.first_name || ""} ${newContact.last_name || ""}`.trim() || "Unknown";
          const source = newContact.attribution_source || "Direct";

          setLiveActivity(prev => [
            {
              time: "Just now",
              event: `New contact: ${name} (${source})`,
              type: "contact",
            },
            ...prev.slice(0, 9),
          ]);

          // Refetch to update metrics
          refetch();
        }
      )
      .subscribe();

    // Subscribe to deals changes
    dealsChannel = supabase
      .channel("deals-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        (payload) => {
          const deal = payload.new as any;
          let event = "";

          if (payload.eventType === "INSERT") {
            event = `New deal: "${deal.deal_name}" in ${deal.stage} ($${deal.deal_value.toLocaleString()})`;
          } else if (payload.eventType === "UPDATE") {
            event = `Deal "${deal.deal_name}" updated to ${deal.stage}`;
          }

          if (event) {
            setLiveActivity(prev => [
              {
                time: "Just now",
                event,
                type: "deal",
              },
              ...prev.slice(0, 9),
            ]);

            // Refetch to update metrics
            refetch();
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      if (contactsChannel) {
        supabase.removeChannel(contactsChannel);
      }
      if (dealsChannel) {
        supabase.removeChannel(dealsChannel);
      }
    };
  }, [refetch]);

  // Merge initial data with live updates
  useEffect(() => {
    if (recentData?.liveActivity && liveActivity.length === 0) {
      setLiveActivity(recentData.liveActivity);
    }
  }, [recentData, liveActivity.length]);

  return {
    liveActivity,
    recentDeals: recentData?.recentDeals || [],
    todayActivity: recentData?.todayActivity || {
      newContacts: 0,
      newDeals: 0,
      emailsSent: 0,
      callsLogged: 0,
      tasksCreated: 0,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function parseTimeAgo(timeStr: string): number {
  if (timeStr === "Just now") return 0;
  const match = timeStr.match(/(\d+)([smhd])/);
  if (!match) return Infinity;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] || 1);
}
