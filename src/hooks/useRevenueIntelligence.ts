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
        if (!deal.created_at || !deal.close_date) return sum;
        const created = new Date(deal.created_at);
        const closed = new Date(deal.close_date);
        if (isNaN(created.getTime()) || isNaN(closed.getTime())) return sum;
        const days = Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, days);
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

      // Calculate time in stage from deal created_at
      const timeInStage = stageBreakdown.map(s => {
        const stageDeals = deals?.filter(d => (d.stage || "Unknown") === s.stage) || [];
        const avgDays =
          stageDeals.length > 0
            ? stageDeals.reduce((sum, d) => {
                const created = d.created_at ? new Date(d.created_at).getTime() : 0;
                return sum + (created ? Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)) : 0);
              }, 0) / stageDeals.length
            : 0;
        return { stage: s.stage, days: Math.round(avgDays) };
      });

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
          duplicateCompanies: 0, // Future: dedup by company_id / domain
          orphanedDeals: 0, // Future: deals where contact_id is null or missing
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
          emailsSent: 0, // Future: requires emails/activity table
          callsLogged: 0, // Future: use call_records count for period
          tasksCreated: 0, // Future: requires tasks table
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
          const newContact = payload.new as Record<string, unknown>;
          const name = `${newContact.first_name || ""} ${newContact.last_name || ""}`.trim() || "Unknown";
          const source = (newContact.attribution_source as string) || "Direct";

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
          const deal = payload.new as Record<string, unknown>;
          let event = "";

          if (payload.eventType === "INSERT") {
            event = `New deal: "${deal.deal_name}" in ${deal.stage} ($${Number(deal.deal_value || 0).toLocaleString()})`;
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
// Tab 5: Revenue by Channel Hook
// ============================================================================

export interface ChannelRevenueData {
  channel: string;
  dealCount: number;
  totalRevenue: number;
  avgDealValue: number;
  conversionRate: number;
  totalContacts: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  organic: "Organic",
  paid_social: "Paid Social",
  paid_search: "Paid Search",
  email: "Email",
  referral: "Referral",
  direct: "Direct",
  unknown: "Unknown",
};

export function useRevenueByChannel(dateRange: string) {
  return useQuery({
    queryKey: ["revenue-by-channel", dateRange],
    queryFn: async () => {
      // Approach: join deals with contacts to get attributed_channel per deal
      // This gives us deal-level channel attribution
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("id, deal_value, amount, stage, contact_id, created_at")
        .order("created_at", { ascending: false });

      if (dealsError) throw dealsError;

      // Fetch contacts with their attributed_channel for all deal contact_ids
      const contactIds = [...new Set(
        (deals || [])
          .map(d => d.contact_id)
          .filter((id): id is string => id !== null)
      )];

      // Batch fetch contacts (Supabase in() has a limit, chunk if needed)
      const CHUNK_SIZE = 500;
      const contactMap = new Map<string, string>();

      for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
        const chunk = contactIds.slice(i, i + CHUNK_SIZE);
        const { data: contacts, error: contactsError } = await supabase
          .from("contacts")
          .select("id, attributed_channel")
          .in("id", chunk);

        if (contactsError) throw contactsError;

        contacts?.forEach(c => {
          contactMap.set(c.id, c.attributed_channel || "unknown");
        });
      }

      // Also get total contacts per channel for conversion rate
      const { data: allContacts, error: allContactsError } = await supabase
        .from("contacts")
        .select("id, attributed_channel");

      if (allContactsError) throw allContactsError;

      const contactsByChannel = (allContacts || []).reduce((acc, c) => {
        const ch = normalizeChannel(c.attributed_channel);
        acc[ch] = (acc[ch] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Group deals by channel
      const channelMap: Record<string, { dealCount: number; totalRevenue: number; closedWon: number }> = {};
      const allChannels = ["organic", "paid_social", "paid_search", "email", "referral", "direct", "unknown"];

      // Initialize all channels
      allChannels.forEach(ch => {
        channelMap[ch] = { dealCount: 0, totalRevenue: 0, closedWon: 0 };
      });

      (deals || []).forEach(deal => {
        const rawChannel = deal.contact_id ? contactMap.get(deal.contact_id) || "unknown" : "unknown";
        const channel = normalizeChannel(rawChannel);

        if (!channelMap[channel]) {
          channelMap[channel] = { dealCount: 0, totalRevenue: 0, closedWon: 0 };
        }

        channelMap[channel].dealCount++;
        const value = Number(deal.deal_value) || Number(deal.amount) || 0;
        channelMap[channel].totalRevenue += value;

        if (deal.stage === "closedwon") {
          channelMap[channel].closedWon++;
        }
      });

      // Build channel data array
      const channelData: ChannelRevenueData[] = Object.entries(channelMap)
        .map(([channel, stats]) => ({
          channel: CHANNEL_LABELS[channel] || channel,
          dealCount: stats.dealCount,
          totalRevenue: stats.totalRevenue,
          avgDealValue: stats.dealCount > 0 ? Math.round(stats.totalRevenue / stats.dealCount) : 0,
          conversionRate: contactsByChannel[channel]
            ? Number(((stats.closedWon / contactsByChannel[channel]) * 100).toFixed(1))
            : 0,
          totalContacts: contactsByChannel[channel] || 0,
        }))
        .filter(ch => ch.dealCount > 0 || ch.totalContacts > 0)
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Summary metrics
      const totalRevenue = channelData.reduce((s, c) => s + c.totalRevenue, 0);
      const totalDeals = channelData.reduce((s, c) => s + c.dealCount, 0);
      const topChannel = channelData[0]?.channel || "N/A";

      return {
        channelData,
        summary: {
          totalRevenue,
          totalDeals,
          topChannel,
          channelCount: channelData.filter(c => c.dealCount > 0).length,
        },
      };
    },
  });
}

function normalizeChannel(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase().trim();

  // Map common variations to standard channel names
  if (lower.includes("organic") || lower === "organic_search" || lower === "organic_social") return "organic";
  if (lower.includes("paid_social") || lower === "facebook" || lower === "instagram" || lower === "meta") return "paid_social";
  if (lower.includes("paid_search") || lower === "google_ads" || lower === "google") return "paid_search";
  if (lower.includes("email") || lower === "email_marketing") return "email";
  if (lower.includes("referral") || lower === "word_of_mouth") return "referral";
  if (lower === "direct" || lower === "none" || lower === "offline") return "direct";

  // Check against known channels
  const knownChannels = ["organic", "paid_social", "paid_search", "email", "referral", "direct"];
  if (knownChannels.includes(lower)) return lower;

  return "unknown";
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
