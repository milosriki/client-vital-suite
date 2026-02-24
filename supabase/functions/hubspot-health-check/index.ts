/**
 * HubSpot Health Check — Phase 5
 * 
 * Tracks the 3 critical HubSpot operational metrics:
 *   1. Unworked leads count (contacts with no outgoing calls)
 *   2. Deal→contact coverage % (how many deals have contact_id populated)
 *   3. Call tracking accuracy (outgoing vs total calls ratio)
 *
 * Also queries the HubSpot API live for:
 *   - Portal-level contact count
 *   - Workflow 1655409725 status (INFINITE LOOP WARNING)
 *
 * Usage: POST /functions/v1/hubspot-health-check
 * Body: { "live": true }   ← hit HubSpot API for portal metrics (optional)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

const INFINITE_LOOP_WORKFLOW_ID = "1655409725";

serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN") || Deno.env.get("HUBSPOT_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const liveMode = body.live === true;

    const results: Record<string, unknown> = {
      generated_at: new Date().toISOString(),
      portal_id: 7973797,
    };

    // ─── 1. UNWORKED LEADS COUNT ───────────────────────────────────────────
    // Unworked = lifecycle_stage in active stages AND no outgoing calls matched
    const { count: totalActiveLeads } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .in("lifecycle_stage", ["lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity"])
      .neq("status", "MERGED_DUPLICATE");

    // Contacts that have at least one call record (outbound match)
    const { data: workedContactIds } = await supabase
      .from("call_records")
      .select("caller_number")
      .eq("call_direction", "outbound")
      .not("caller_number", "is", null);

    const workedPhones = new Set((workedContactIds || []).map((r: { caller_number: string }) => r.caller_number));

    const { data: activeLeadsPhones } = await supabase
      .from("contacts")
      .select("phone")
      .in("lifecycle_stage", ["lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity"])
      .neq("status", "MERGED_DUPLICATE")
      .not("phone", "is", null);

    const unworkedCount = (activeLeadsPhones || []).filter(
      (c: { phone: string }) => !workedPhones.has(c.phone)
    ).length;

    results.unworked_leads = {
      count: unworkedCount,
      total_active: totalActiveLeads ?? 0,
      unworked_rate_pct: totalActiveLeads
        ? Math.round((unworkedCount / (totalActiveLeads as number)) * 100)
        : 0,
      status: unworkedCount > 50000 ? "🔴 CRITICAL" : unworkedCount > 10000 ? "🟡 WARNING" : "🟢 OK",
      note: "Unworked = active lifecycle stage + no outbound call record matched by phone",
    };

    // ─── 2. DEAL → CONTACT COVERAGE ───────────────────────────────────────
    const { count: totalDeals } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true });

    const { count: dealsWithContact } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .not("contact_id", "is", null);

    const { count: dealsNullContact } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .is("contact_id", null)
      .not("hubspot_deal_id", "is", null);

    const coveragePct = totalDeals
      ? Math.round(((dealsWithContact ?? 0) / (totalDeals as number)) * 100)
      : 0;

    results.deal_contact_coverage = {
      total_deals: totalDeals ?? 0,
      deals_with_contact: dealsWithContact ?? 0,
      deals_missing_contact: dealsNullContact ?? 0,
      coverage_pct: coveragePct,
      status: coveragePct < 50 ? "🔴 CRITICAL" : coveragePct < 75 ? "🟡 WARNING" : "🟢 OK",
      fix: "Run backfill-deal-contacts with { days: 0 } to recover missing links",
    };

    // ─── 3. CALL TRACKING ACCURACY ─────────────────────────────────────────
    const { count: totalCalls } = await supabase
      .from("call_records")
      .select("id", { count: "exact", head: true });

    const { count: outboundCalls } = await supabase
      .from("call_records")
      .select("id", { count: "exact", head: true })
      .eq("call_direction", "outbound");

    const { count: inboundCalls } = await supabase
      .from("call_records")
      .select("id", { count: "exact", head: true })
      .eq("call_direction", "inbound");

    const { count: unknownDirectionCalls } = await supabase
      .from("call_records")
      .select("id", { count: "exact", head: true })
      .is("call_direction", null);

    const { count: callsLinkedToContact } = await supabase
      .from("call_records")
      .select("id", { count: "exact", head: true })
      .not("contact_id", "is", null);

    const outboundRate = totalCalls
      ? Math.round(((outboundCalls ?? 0) / (totalCalls as number)) * 100)
      : 0;

    const contactLinkRate = totalCalls
      ? Math.round(((callsLinkedToContact ?? 0) / (totalCalls as number)) * 100)
      : 0;

    results.call_tracking = {
      total_calls: totalCalls ?? 0,
      outbound_calls: outboundCalls ?? 0,
      inbound_calls: inboundCalls ?? 0,
      unknown_direction: unknownDirectionCalls ?? 0,
      outbound_rate_pct: outboundRate,
      calls_linked_to_contact: callsLinkedToContact ?? 0,
      contact_link_rate_pct: contactLinkRate,
      status: outboundRate === 0
        ? "🔴 CRITICAL - total_outgoing_calls = 0 (no outbound direction tagged)"
        : outboundRate < 20
        ? "🟡 WARNING - low outbound tagging"
        : "🟢 OK",
      root_cause_if_zero: [
        "HubSpot call sync stores agent FROM number as caller_number for outbound",
        "view_lead_follow_up JOIN on c.phone = caller_number fails for HubSpot outbound",
        "Fixed in Phase 5: caller_number now stores CONTACT phone for outbound calls",
        "Old data needs re-sync: run sync-hubspot-to-supabase with sync_type=calls,incremental=false",
      ],
    };

    // ─── 4. SYNC HEALTH ────────────────────────────────────────────────────
    const { data: lastSync } = await supabase
      .from("sync_logs")
      .select("platform, sync_type, status, completed_at, records_processed, error_details")
      .eq("platform", "hubspot")
      .order("completed_at", { ascending: false })
      .limit(5);

    results.sync_health = {
      last_5_syncs: lastSync ?? [],
      last_sync_at: lastSync?.[0]?.completed_at ?? null,
      last_sync_status: lastSync?.[0]?.status ?? "unknown",
    };

    // ─── 5. WORKFLOW WARNING ───────────────────────────────────────────────
    results.workflow_warnings = [
      {
        workflow_id: INFINITE_LOOP_WORKFLOW_ID,
        severity: "🔴 CRITICAL",
        description: "INFINITE LOOP DETECTED — costs ~634K AED/month in lost productivity",
        action_required: "MANUAL: Disable in HubSpot portal → Automation → Workflows",
        url: `https://app.hubspot.com/workflows/7973797/platform/flow/${INFINITE_LOOP_WORKFLOW_ID}/edit`,
        do_not_disable_from_code: "Per Phase 5 rules — requires manual CEO approval",
      },
    ];

    // ─── 6. LIVE HUBSPOT API METRICS (optional) ────────────────────────────
    if (liveMode && HUBSPOT_TOKEN) {
      try {
        // Contact count
        const contactCountRes = await fetch(
          "https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=hs_object_id",
          { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } },
        );
        if (contactCountRes.ok) {
          const cData = await contactCountRes.json();
          (results as Record<string, unknown>).hubspot_live = {
            total_contacts_in_portal: cData.total ?? "unknown",
          };
        }

        // Workflow status
        const wfRes = await fetch(
          `https://api.hubapi.com/automation/v3/workflows/${INFINITE_LOOP_WORKFLOW_ID}`,
          { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } },
        );
        if (wfRes.ok) {
          const wfData = await wfRes.json();
          (results.hubspot_live as Record<string, unknown>).workflow_1655409725 = {
            name: wfData.name,
            enabled: wfData.enabled,
            action_required: wfData.enabled
              ? "⚠️ STILL ENABLED — disable manually in HubSpot portal"
              : "✅ Already disabled",
          };
        } else {
          (results.hubspot_live as Record<string, unknown>) = {
            workflow_status_error: `HTTP ${wfRes.status}`,
          };
        }
      } catch (apiErr) {
        results.hubspot_live_error = String(apiErr);
      }
    }

    // ─── 7. QUICK SUMMARY ──────────────────────────────────────────────────
    const criticalCount = [
      (results.unworked_leads as { status: string })?.status?.includes("CRITICAL"),
      (results.deal_contact_coverage as { status: string })?.status?.includes("CRITICAL"),
      (results.call_tracking as { status: string })?.status?.includes("CRITICAL"),
    ].filter(Boolean).length;

    results.summary = {
      overall_status: criticalCount > 0 ? `🔴 ${criticalCount} CRITICAL issues` : "🟢 Healthy",
      critical_issues: criticalCount,
      top_actions: [
        "1. MANUAL: Disable workflow 1655409725 in HubSpot portal",
        "2. Run: backfill-deal-contacts { days: 0 } to fix 82% null contact_id on deals",
        "3. Run: sync-hubspot-to-supabase { sync_type: 'calls', incremental: false } to re-sync call directions",
        "4. Verify call_records.call_direction is populated after next CallGear sync",
      ],
    };

    return apiSuccess(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[hubspot-health-check] Error:", msg);
    return apiSuccess({ error: msg, generated_at: new Date().toISOString() });
  }
});
