// ============================================
// COMMAND CENTER EXECUTOR
// Atlas AI tools for full-chain intelligence
// ============================================

const VALID_ACTIONS = [
  "get_campaign_funnel",
  "get_adset_funnel",
  "get_creative_funnel",
  "get_lead_journey",
  "get_setter_funnel",
  "get_cold_leads",
  "get_no_shows",
  "get_upcoming_assessments",
  "get_money_chain",
  "diagnose_campaign",
] as const;

/** Strip characters that could manipulate PostgREST filter syntax */
function sanitizeFilter(input: string): string {
  return input.replace(/[^a-zA-Z0-9\s\-_]/g, "");
}

export async function executeCommandCenterTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "command_center_control": {
      const { action, campaign, setter, days = 30 } = input;

      // Validate action upfront
      if (!action || !VALID_ACTIONS.includes(action)) {
        return JSON.stringify({
          error: `Invalid action: "${action}". Valid actions: ${VALID_ACTIONS.join(", ")}`,
        });
      }

      if (action === "get_campaign_funnel") {
        let query = supabase.from("campaign_full_funnel").select("*");
        if (campaign) query = query.ilike("campaign", `%${sanitizeFilter(campaign)}%`);
        const { data, error } = await query.order("spend", { ascending: false }).limit(50);
        if (error) throw error;
        return JSON.stringify({
          campaigns: data || [],
          total: data?.length || 0,
          summary: {
            total_spend: (data || []).reduce((s: number, r: any) => s + Number(r.spend || 0), 0),
            total_revenue: (data || []).reduce((s: number, r: any) => s + Number(r.revenue || 0), 0),
            scale_count: (data || []).filter((r: any) => r.verdict === "SCALE").length,
            fix_count: (data || []).filter((r: any) =>
              ["BAD_LEADS", "FIX_FOLLOWUP", "FIX_COACH", "FIX_ROAS"].includes(r.verdict)).length,
          },
        });
      }

      if (action === "get_adset_funnel") {
        let query = supabase.from("adset_full_funnel").select("*");
        if (campaign) query = query.ilike("campaign_name", `%${sanitizeFilter(campaign)}%`);
        if (input.adset) query = query.ilike("adset_name", `%${sanitizeFilter(input.adset)}%`);
        const { data, error } = await query.order("spend", { ascending: false }).limit(100);
        if (error) throw error;
        return JSON.stringify({
          adsets: data || [],
          total: data?.length || 0,
          summary: {
            total_spend: (data || []).reduce((s: number, r: any) => s + Number(r.spend || 0), 0),
            total_revenue: (data || []).reduce((s: number, r: any) => s + Number(r.revenue || 0), 0),
            scale_count: (data || []).filter((r: any) => r.verdict === "SCALE").length,
            fix_count: (data || []).filter((r: any) =>
              ["BAD_LEADS", "FIX_FOLLOWUP", "FIX_COACH", "FIX_ROAS"].includes(r.verdict)).length,
          },
        });
      }

      if (action === "get_creative_funnel") {
        let query = supabase.from("ad_creative_funnel").select("*");
        if (campaign) query = query.ilike("campaign_name", `%${sanitizeFilter(campaign)}%`);
        if (input.adset) query = query.ilike("adset_name", `%${sanitizeFilter(input.adset)}%`);
        if (input.ad) query = query.ilike("ad_name", `%${sanitizeFilter(input.ad)}%`);
        const { data, error } = await query.order("spend", { ascending: false }).limit(100);
        if (error) throw error;
        const winners = (data || []).filter((r: any) => r.creative_verdict === "WINNER");
        const losers = (data || []).filter((r: any) =>
          ["UNPROFITABLE", "LOW_QUALITY", "BAD_LEADS"].includes(r.creative_verdict));
        return JSON.stringify({
          creatives: data || [],
          total: data?.length || 0,
          summary: {
            total_spend: (data || []).reduce((s: number, r: any) => s + Number(r.spend || 0), 0),
            total_revenue: (data || []).reduce((s: number, r: any) => s + Number(r.revenue || 0), 0),
            winners: winners.length,
            losers: losers.length,
            avg_video_completion: data?.length
              ? Math.round((data || []).reduce((s: number, r: any) => s + Number(r.video_completion_pct || 0), 0) / data.length)
              : 0,
          },
          top_winners: winners.slice(0, 5).map((r: any) => ({
            ad_name: r.ad_name, spend: r.spend, revenue: r.revenue, roas: r.roas,
          })),
          worst_performers: losers.slice(0, 5).map((r: any) => ({
            ad_name: r.ad_name, spend: r.spend, revenue: r.revenue,
            verdict: r.creative_verdict, quality: r.quality_ranking,
          })),
        });
      }

      if (action === "get_lead_journey") {
        const { email, name, phone } = input;
        if (!email && !name && !phone) {
          return JSON.stringify({ error: "Provide email, name, or phone to search lead journey" });
        }
        let query = supabase.from("lead_full_journey").select("*");
        if (email) {
          query = query.ilike("email", `%${sanitizeFilter(email)}%`);
        } else if (phone) {
          query = query.ilike("phone", `%${sanitizeFilter(phone)}%`);
        } else if (name) {
          const safeName = sanitizeFilter(name);
          query = query.or(`first_name.ilike.%${safeName}%,last_name.ilike.%${safeName}%`);
        }
        const { data, error } = await query.limit(10);
        if (error) throw error;
        return JSON.stringify({
          leads: (data || []).map((l: any) => ({
            ...l,
            journey_summary: [
              l.lead_created_at ? `Created: ${new Date(l.lead_created_at).toLocaleDateString()}` : null,
              l.attribution_campaign ? `Campaign: ${l.attribution_campaign}` : null,
              l.fb_adset_name ? `Adset: ${l.fb_adset_name}` : null,
              l.fb_ad_name ? `Ad: ${l.fb_ad_name}` : null,
              l.total_calls ? `Calls: ${l.total_calls} (${l.completed_calls || 0} connected)` : null,
              l.latest_agent ? `Agent: ${l.latest_agent}` : null,
              l.deal_stage_label ? `Deal: ${l.deal_stage_label}` : null,
              l.deal_value ? `Value: ${Number(l.deal_value).toLocaleString()} AED` : null,
              l.assigned_coach ? `Coach: ${l.assigned_coach}` : null,
              l.health_score != null ? `Health: ${l.health_score} (${l.health_zone})` : null,
            ].filter(Boolean),
          })),
          total: data?.length || 0,
        });
      }

      if (action === "get_setter_funnel") {
        let query = supabase.from("setter_funnel_matrix").select("*");
        if (setter) {
          const safeSetter = sanitizeFilter(setter);
          query = query.ilike("setter_name", `%${safeSetter}%`);
        }
        const { data, error } = await query.limit(50);
        if (error) throw error;
        return JSON.stringify(data || []);
      }

      if (action === "get_cold_leads") {
        const { data, error } = await supabase.from("cold_leads").select("*").limit(30);
        if (error) throw error;
        return JSON.stringify({
          cold_leads: data || [], total: data?.length || 0,
          critical: (data || []).filter((l: any) => l.urgency === "CRITICAL").length,
          urgent: (data || []).filter((l: any) => l.urgency === "URGENT").length,
        });
      }

      if (action === "get_no_shows") {
        const { data, error } = await supabase.from("assessment_truth_matrix").select("*")
          .in("truth_status", ["BOOKED_NOT_ATTENDED", "HUBSPOT_ONLY_NO_AWS_PROOF"]).limit(30);
        if (error) throw error;
        return JSON.stringify({ no_shows: data || [], total: data?.length || 0 });
      }

      if (action === "get_upcoming_assessments") {
        const { data, error } = await supabase.from("upcoming_assessments").select("*").limit(30);
        if (error) throw error;
        return JSON.stringify({
          assessments: data || [], total: data?.length || 0,
          today: (data || []).filter((a: any) => Number(a.days_until) === 0).length,
          tomorrow: (data || []).filter((a: any) => Number(a.days_until) === 1).length,
        });
      }

      if (action === "get_money_chain") {
        const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
        const since = new Date();
        since.setDate(since.getDate() - safeDays);
        const sinceDate = since.toISOString().split("T")[0];
        const sinceISO = since.toISOString();

        const [adResult, leadsResult, dealsResult] = await Promise.all([
          supabase.from("facebook_ads_insights").select("spend").gte("date", sinceDate),
          supabase.from("contacts").select("id", { count: "exact", head: true }).gte("created_at", sinceISO),
          supabase.from("deals").select("stage, deal_value").gte("updated_at", sinceISO),
        ]);

        const adSpend = (adResult.data || []).reduce((s: number, r: any) => s + (r.spend || 0), 0);
        const leads = leadsResult.count || 0;
        const bookingStages = new Set([
          "122237508", "122237276", "122221229", "qualifiedtobuy",
          "decisionmakerboughtin", "2900542", "987633705", "closedwon",
        ]);
        let bookings = 0, closedWon = 0, revenue = 0;
        (dealsResult.data || []).forEach((d: any) => {
          if (bookingStages.has(d.stage || "")) bookings++;
          if (d.stage === "closedwon") { closedWon++; revenue += d.deal_value || 0; }
        });

        return JSON.stringify({
          period: `Last ${safeDays} days`, ad_spend: Math.round(adSpend), leads, bookings,
          closed_won: closedWon, revenue: Math.round(revenue),
          roas: adSpend > 0 ? (revenue / adSpend).toFixed(1) : "N/A",
          cpl: adSpend > 0 && leads > 0 ? Math.round(adSpend / leads) : 0,
          cpo: adSpend > 0 && closedWon > 0 ? Math.round(adSpend / closedWon) : 0,
        });
      }

      if (action === "diagnose_campaign") {
        if (!campaign) return JSON.stringify({ error: "Campaign name required for diagnosis" });
        const { data: funnelData } = await supabase.from("campaign_full_funnel").select("*")
          .ilike("campaign", `%${sanitizeFilter(campaign)}%`).limit(1).single();
        if (!funnelData) return JSON.stringify({ error: `Campaign "${sanitizeFilter(campaign)}" not found` });

        const f = funnelData;
        const diagnosis: string[] = [];
        if (f.verdict === "SCALE") diagnosis.push(`ROAS ${f.roas}x — performing well. Increase budget.`);
        if (f.verdict === "BAD_LEADS") diagnosis.push(`Lead→book ${f.lead_to_book_pct}% (below 15%). Low quality leads or slow setter response.`);
        if (f.verdict === "FIX_FOLLOWUP") diagnosis.push(`Book→held ${f.book_to_held_pct}% (below 50%). People ghost after booking. Fix follow-up.`);
        if (f.verdict === "FIX_COACH") diagnosis.push(`Held→close ${f.held_to_close_pct}% (below 15%). Coach closing needs improvement.`);
        if (f.verdict === "FIX_ROAS") diagnosis.push(`ROAS ${f.roas}x (below 1x). Spending more than earning.`);

        return JSON.stringify({
          campaign: f.campaign, verdict: f.verdict,
          metrics: { spend: f.spend, leads: f.db_leads, booked: f.booked, held: f.held, closed_won: f.closed_won, revenue: f.revenue, roas: f.roas, cpl: f.cpl, cpo: f.cpo },
          conversion_rates: { lead_to_book: `${f.lead_to_book_pct}%`, book_to_held: `${f.book_to_held_pct}%`, held_to_close: `${f.held_to_close_pct}%` },
          diagnosis,
        });
      }

      return JSON.stringify({ error: `Unknown action: ${action}` });
    }
    default:
      return `Tool ${toolName} not handled by Command Center executor.`;
  }
}
