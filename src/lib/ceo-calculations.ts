import { ClientHealthMetrics, IntegrationStatus } from "@/types/ceo";

// Derived from use-ceo-data.ts logic
export function calculateClientHealth(
  data: any[],
  latestDate: string,
): ClientHealthMetrics {
  if (!latestDate) {
    return {
      green: 0,
      yellow: 0,
      red: 0,
      purple: 0,
      total: 0,
      atRiskRevenue: 0,
      avgHealth: 0,
    };
  }

  const zones: Record<string, number> = {
    green: 0,
    yellow: 0,
    red: 0,
    purple: 0,
  };
  let atRiskRevenue = 0;
  let totalScore = 0;

  data.forEach((c) => {
    const zone = (c.health_zone || "yellow").toLowerCase();

    // Safety check for unknown zones
    if (zone in zones) {
      zones[zone as keyof typeof zones]++;
    } else {
      // Fallback or ignore? The original logic assumes it exists in 'zones'
      // Original: if (zone in zones) zones[zone as keyof typeof zones]++;
    }

    if (zone === "red" || zone === "yellow") {
      atRiskRevenue += c.package_value_aed || 0;
    }
    totalScore += c.health_score || 0;
  });

  return {
    ...zones,
    total: data.length,
    atRiskRevenue,
    avgHealth: data.length ? Math.round(totalScore / data.length) : 0,
  } as ClientHealthMetrics;
}

export function calculateIntegrationStatus(
  syncLogs: any[],
  syncErrors: any[],
): IntegrationStatus {
  const platforms = ["hubspot", "stripe", "callgear", "facebook"];
  const status: IntegrationStatus = {};

  platforms.forEach((p) => {
    const logs = syncLogs.filter((l: any) => l.platform === p);
    const errors = syncErrors.filter((e: any) => e.source === p);
    const lastLog = logs[0] as any; // Assumes logs are sorted desc

    status[p] = {
      connected: logs.some((l: any) => l.status === "success"),
      lastSync: lastLog?.started_at || null,
      errors: errors.length,
    };
  });

  return status;
}
