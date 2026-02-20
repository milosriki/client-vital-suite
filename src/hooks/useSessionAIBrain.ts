import { useMemo } from "react";
import type { ClientSessionProfile, CoachActivityProfile, RedZoneAlert } from "./useSessionIntelligence";

export interface AIInsight {
  id: string;
  severity: "critical" | "warning" | "info" | "opportunity";
  category: "retention" | "coach" | "revenue" | "pattern" | "operational";
  title: string;
  description: string;
  action: string;
  metric?: string;
  affected?: string[];
}

/**
 * AI Brain — proactive pattern analysis on session data.
 * Generates actionable insights from client profiles, coach profiles, and alerts.
 */
export function useSessionAIBrain(
  clientProfiles: ClientSessionProfile[],
  coachProfiles: CoachActivityProfile[],
  redZoneAlerts: RedZoneAlert[],
) {
  return useMemo<AIInsight[]>(() => {
    const insights: AIInsight[] = [];
    const now = new Date();

    // ─── 1. RETENTION INSIGHTS ───

    // Ghost clients — revenue at risk (pattern-relative, not flat cutoff)
    const ghosts = clientProfiles.filter((c) => c.frequency_label === "Ghost");
    if (ghosts.length > 0) {
      // Separate ghosts with known patterns vs unknown
      const knownPattern = ghosts.filter((g) => g.avg_days_between !== null);
      const avgOverdue = knownPattern.length > 0
        ? Math.round(knownPattern.reduce((s, g) => s + g.days_since_last / (g.avg_days_between || 1), 0) / knownPattern.length)
        : 0;

      insights.push({
        id: "ghost-clients",
        severity: "critical",
        category: "retention",
        title: `${ghosts.length} Ghost Clients — Significantly Overdue`,
        description: knownPattern.length > 0
          ? `These clients are on average ${avgOverdue}x past their normal training interval. This is pattern-based detection, not a simple day count.`
          : `These clients haven't trained in a long time relative to their history.`,
        action: `Priority call list: ${ghosts.slice(0, 5).map((g) => {
          const gap = g.avg_days_between ? ` (normally every ${g.avg_days_between}d, now ${g.days_since_last}d)` : ` (${g.days_since_last}d absent)`;
          return `${g.client_name}${gap}`;
        }).join("; ")}${ghosts.length > 5 ? ` +${ghosts.length - 5} more` : ""}`,
        metric: `${ghosts.length} clients at risk`,
        affected: ghosts.map((g) => g.client_name),
      });
    }

    // Slowing clients — early warning
    const slowing = clientProfiles.filter((c) => c.frequency_label === "Slowing");
    if (slowing.length > 0) {
      insights.push({
        id: "slowing-clients",
        severity: "warning",
        category: "retention",
        title: `${slowing.length} Clients Slowing Down — Frequency Dropping`,
        description: `These clients are still training but less frequently. Proactive outreach prevents them becoming inactive.`,
        action: `Have coaches check in: ${slowing.slice(0, 5).map((s) => `${s.client_name} (${s.coach_name})`).join(", ")}`,
        metric: `Avg ${Math.round(slowing.reduce((s, c) => s + c.sessions_last_30d, 0) / slowing.length)} sessions/30d`,
        affected: slowing.map((s) => s.client_name),
      });
    }

    // Clients with declining trend
    const declining = clientProfiles.filter((c) => c.trend === "down" && c.frequency_label !== "Ghost");
    if (declining.length >= 3) {
      insights.push({
        id: "declining-trend",
        severity: "warning",
        category: "pattern",
        title: `${declining.length} Clients with Declining Session Trend`,
        description: `Their recent 7-day activity is significantly below their 30-day average. This often precedes dropout.`,
        action: `Review and re-engage: ${declining.slice(0, 5).map((d) => d.client_name).join(", ")}`,
        affected: declining.map((d) => d.client_name),
      });
    }

    // ─── 2. COACH INSIGHTS ───

    // Coaches with high inactive ratio
    for (const coach of coachProfiles) {
      if (coach.unique_clients >= 3) {
        const inactiveRatio = coach.clients_inactive_7d / coach.unique_clients;
        if (inactiveRatio > 0.5) {
          insights.push({
            id: `coach-inactive-${coach.coach_name}`,
            severity: "critical",
            category: "coach",
            title: `${coach.coach_name}: ${Math.round(inactiveRatio * 100)}% Clients Inactive`,
            description: `${coach.clients_inactive_7d} of ${coach.unique_clients} clients haven't trained in 7+ days. This coach may need support or the clients need re-engagement.`,
            action: `Review ${coach.coach_name}'s client list. Check if scheduling issues, client dissatisfaction, or coach availability is the cause.`,
            metric: `${coach.clients_inactive_7d}/${coach.unique_clients} inactive`,
          });
        }
      }
    }

    // Coach with no recent sessions
    const idleCoaches = coachProfiles.filter((c) => c.days_since_last > 7 && c.unique_clients > 0);
    if (idleCoaches.length > 0) {
      insights.push({
        id: "idle-coaches",
        severity: "warning",
        category: "coach",
        title: `${idleCoaches.length} Coach${idleCoaches.length > 1 ? "es" : ""} with No Sessions in 7+ Days`,
        description: `These coaches haven't had any training sessions recently: ${idleCoaches.map((c) => `${c.coach_name} (${c.days_since_last}d)`).join(", ")}`,
        action: `Check coach availability and client assignment. Redistribute clients if needed.`,
        affected: idleCoaches.map((c) => c.coach_name),
      });
    }

    // Coach workload imbalance
    if (coachProfiles.length >= 2) {
      const activeCoaches = coachProfiles.filter((c) => c.sessions_last_30d > 0);
      if (activeCoaches.length >= 2) {
        const avg = activeCoaches.reduce((s, c) => s + c.sessions_last_30d, 0) / activeCoaches.length;
        const overloaded = activeCoaches.filter((c) => c.sessions_last_30d > avg * 1.8);
        const underloaded = activeCoaches.filter((c) => c.sessions_last_30d < avg * 0.4);
        if (overloaded.length > 0 && underloaded.length > 0) {
          insights.push({
            id: "workload-imbalance",
            severity: "info",
            category: "operational",
            title: "Coach Workload Imbalance Detected",
            description: `${overloaded.map((c) => c.coach_name).join(", ")} ${overloaded.length > 1 ? "are" : "is"} handling 80%+ above average while ${underloaded.map((c) => c.coach_name).join(", ")} ${underloaded.length > 1 ? "are" : "is"} far below.`,
            action: `Rebalance client assignments. Move some clients from ${overloaded[0]?.coach_name} to ${underloaded[0]?.coach_name}.`,
            metric: `Range: ${Math.min(...activeCoaches.map((c) => c.sessions_last_30d))} - ${Math.max(...activeCoaches.map((c) => c.sessions_last_30d))} sessions/30d`,
          });
        }
      }
    }

    // ─── 3. CROSS-COACH ANALYSIS ───

    // Clients trained by multiple coaches
    const clientCoachMap = new Map<string, Set<string>>();
    for (const cp of clientProfiles) {
      // Check all sessions for this client across coaches
      if (!clientCoachMap.has(cp.client_name)) clientCoachMap.set(cp.client_name, new Set());
      clientCoachMap.get(cp.client_name)!.add(cp.coach_name);
    }
    // Actually need raw session data for multi-coach — this interface only has most recent coach
    // We'll handle this in the hook aggregation instead

    // ─── 4. OPPORTUNITY INSIGHTS ───

    // High-frequency clients — upsell candidates
    const highFreq = clientProfiles.filter((c) => c.sessions_last_30d >= 12 && c.frequency_label === "Active");
    if (highFreq.length > 0) {
      insights.push({
        id: "upsell-candidates",
        severity: "opportunity" as never,
        category: "revenue",
        title: `${highFreq.length} High-Frequency Clients — Upsell Opportunity`,
        description: `These clients train 3+ times/week. They're committed and ideal for premium packages, group add-ons, or nutrition plans.`,
        action: `Upsell targets: ${highFreq.slice(0, 5).map((h) => `${h.client_name} (${h.sessions_last_30d} sessions/mo)`).join(", ")}`,
        metric: `Avg ${Math.round(highFreq.reduce((s, c) => s + c.sessions_last_30d, 0) / highFreq.length)} sessions/mo`,
        affected: highFreq.map((h) => h.client_name),
      });
    }

    // Clients who came back after being inactive
    const recovered = clientProfiles.filter(
      (c) => c.sessions_last_7d > 0 && c.avg_days_between !== null && c.avg_days_between > 14,
    );
    if (recovered.length > 0) {
      insights.push({
        id: "recovered-clients",
        severity: "info",
        category: "pattern",
        title: `${recovered.length} Clients Returned After Long Gap`,
        description: `These clients had irregular attendance but recently came back. Reinforce the habit now.`,
        action: `Coach follow-up: ensure next session is booked for ${recovered.slice(0, 5).map((r) => r.client_name).join(", ")}`,
        affected: recovered.map((r) => r.client_name),
      });
    }

    // ─── 5. OVERALL HEALTH ───

    const totalActive = clientProfiles.filter((c) => c.frequency_label === "Active").length;
    const totalClients = clientProfiles.length;
    const healthPercent = totalClients > 0 ? Math.round((totalActive / totalClients) * 100) : 0;

    if (healthPercent < 50) {
      insights.push({
        id: "low-health",
        severity: "critical",
        category: "operational",
        title: `Only ${healthPercent}% of Clients Are Active`,
        description: `${totalActive} of ${totalClients} tracked clients are training regularly. The majority are slowing, inactive, or ghost.`,
        action: `Immediate team meeting needed. Review inactive list, assign follow-up calls, identify systemic issues (scheduling, pricing, coach quality).`,
        metric: `${totalActive}/${totalClients} active (${healthPercent}%)`,
      });
    } else if (healthPercent >= 75) {
      insights.push({
        id: "high-health",
        severity: "info",
        category: "operational",
        title: `Strong Client Health: ${healthPercent}% Active`,
        description: `${totalActive} of ${totalClients} clients are training regularly. Focus on maintaining this and growing the base.`,
        action: `Keep momentum. Focus on the ${totalClients - totalActive} non-active clients.`,
        metric: `${totalActive}/${totalClients} active (${healthPercent}%)`,
      });
    }

    // Sort: critical first, then warning, then opportunity, then info
    const severityOrder = { critical: 0, warning: 1, opportunity: 2, info: 3 };
    insights.sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

    return insights;
  }, [clientProfiles, coachProfiles, redZoneAlerts]);
}
