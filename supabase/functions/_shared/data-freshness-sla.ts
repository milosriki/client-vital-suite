/**
 * Data Freshness SLA Monitor
 * Enterprise pattern: Alert when sync data goes stale
 *
 * Per observability-engineer skill:
 * - Define SLIs (Service Level Indicators) for data freshness
 * - Alert when SLO (Service Level Objective) is breached
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface FreshnessResult {
  platform: string;
  lastSyncAt: string | null;
  ageMinutes: number;
  sloMinutes: number;
  breached: boolean;
  status: "fresh" | "stale" | "critical" | "unknown";
}

// SLO definitions: maximum acceptable data age per platform
const FRESHNESS_SLOS: Record<string, number> = {
  hubspot: 240, // 4 hours
  stripe: 360, // 6 hours
  callgear: 480, // 8 hours
  facebook: 1440, // 24 hours
  anytrack: 720, // 12 hours
};

/**
 * Check data freshness for all platforms against SLOs
 */
export async function checkDataFreshness(
  supabase: ReturnType<typeof createClient>,
): Promise<FreshnessResult[]> {
  const results: FreshnessResult[] = [];

  for (const [platform, sloMinutes] of Object.entries(FRESHNESS_SLOS)) {
    try {
      const { data: syncLog } = await supabase
        .from("sync_logs")
        .select("started_at, status")
        .eq("platform", platform)
        .eq("status", "success")
        .order("started_at", { ascending: false })
        .limit(1);

      const lastSync = syncLog?.[0]?.started_at || null;
      const ageMinutes = lastSync
        ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000)
        : Infinity;

      const breached = ageMinutes > sloMinutes;
      const status: FreshnessResult["status"] = !lastSync
        ? "unknown"
        : ageMinutes <= sloMinutes
          ? "fresh"
          : ageMinutes <= sloMinutes * 2
            ? "stale"
            : "critical";

      results.push({
        platform,
        lastSyncAt: lastSync,
        ageMinutes: ageMinutes === Infinity ? -1 : ageMinutes,
        sloMinutes,
        breached,
        status,
      });

      // Auto-alert on SLO breach
      if (breached) {
        console.warn(
          `⚠️ [DataFreshness] SLO BREACH: ${platform} data is ${ageMinutes}min old (SLO: ${sloMinutes}min)`,
        );

        // Insert notification for dashboard
        await supabase
          .from("notifications")
          .insert({
            type: "data_freshness_breach",
            title: `${platform} data is stale`,
            message: `Last successful sync was ${ageMinutes} minutes ago. SLO: ${sloMinutes} minutes.`,
            severity: status === "critical" ? "critical" : "warning",
            metadata: { platform, ageMinutes, sloMinutes },
          })
          .catch(() => {
            // notifications table may not exist yet, that's ok
          });
      }
    } catch (error) {
      console.error(`[DataFreshness] Error checking ${platform}:`, error);
      results.push({
        platform,
        lastSyncAt: null,
        ageMinutes: -1,
        sloMinutes,
        breached: true,
        status: "unknown",
      });
    }
  }

  return results;
}

/**
 * Get a summary of all platform freshness
 */
export function getFreshnessSummary(results: FreshnessResult[]): {
  allFresh: boolean;
  breachedCount: number;
  criticalCount: number;
  platforms: Record<string, string>;
} {
  const breached = results.filter((r) => r.breached);
  const critical = results.filter((r) => r.status === "critical");

  return {
    allFresh: breached.length === 0,
    breachedCount: breached.length,
    criticalCount: critical.length,
    platforms: Object.fromEntries(results.map((r) => [r.platform, r.status])),
  };
}
