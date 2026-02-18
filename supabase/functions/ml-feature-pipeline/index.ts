import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // 1. Load all data sources in parallel
    const [
      { data: packages },
      { data: sessions },
      { data: contacts },
      { data: calls },
      { data: deals },
      { data: stripeEvents },
    ] = await Promise.all([
      sb.from("client_packages_live").select("*"),
      sb.from("training_sessions_live").select("*"),
      sb.from("contacts").select("*"),
      sb.from("call_records").select("*"),
      sb.from("deals").select("*"),
      sb.from("stripe_events").select("*").in("event_type", [
        "invoice.payment_succeeded", "invoice.payment_failed",
        "charge.succeeded", "charge.failed", "charge.refunded",
        "customer.subscription.deleted",
      ]),
    ]);

    if (!packages?.length) {
      return new Response(JSON.stringify({ success: false, error: "No packages found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Index data by client
    const sessionsByClient = new Map<string, any[]>();
    for (const s of sessions ?? []) {
      const key = s.client_email?.toLowerCase();
      if (!key) continue;
      if (!sessionsByClient.has(key)) sessionsByClient.set(key, []);
      sessionsByClient.get(key)!.push(s);
    }

    const callsByNumber = new Map<string, any[]>();
    for (const c of calls ?? []) {
      const phone = c.caller_number;
      if (phone) {
        if (!callsByNumber.has(phone)) callsByNumber.set(phone, []);
        callsByNumber.get(phone)!.push(c);
      }
    }

    const contactsByEmail = new Map<string, any>();
    for (const c of contacts ?? []) {
      if (c.email) contactsByEmail.set(c.email.toLowerCase(), c);
    }

    const dealsByContactId = new Map<string, any[]>();
    for (const d of deals ?? []) {
      if (d.contact_id) {
        if (!dealsByContactId.has(d.contact_id)) dealsByContactId.set(d.contact_id, []);
        dealsByContactId.get(d.contact_id)!.push(d);
      }
    }

    // 3. Compute features per client (from packages)
    const features: any[] = [];

    for (const pkg of packages) {
      const email = pkg.client_email?.toLowerCase();
      if (!email) continue;

      const clientSessions = sessionsByClient.get(email) ?? [];
      const contact = contactsByEmail.get(email);
      const clientCalls = contact?.phone ? (callsByNumber.get(contact.phone) ?? []) : [];
      const clientDeals = contact?.id ? (dealsByContactId.get(contact.id) ?? []) : [];

      // Sort sessions by date
      const completedSessions = clientSessions
        .filter((s: any) => s.status === "Completed")
        .sort((a: any, b: any) => new Date(b.training_date).getTime() - new Date(a.training_date).getTime());

      const cancelledSessions = clientSessions.filter((s: any) =>
        s.status?.toLowerCase().includes("cancel")
      );

      const nowMs = now.getTime();
      const day = 86400000;

      // Session features
      const sessions_7d = completedSessions.filter((s: any) =>
        nowMs - new Date(s.training_date).getTime() < 7 * day
      ).length;
      const sessions_30d = completedSessions.filter((s: any) =>
        nowMs - new Date(s.training_date).getTime() < 30 * day
      ).length;
      const sessions_90d = completedSessions.filter((s: any) =>
        nowMs - new Date(s.training_date).getTime() < 90 * day
      ).length;

      // Session gaps
      const gaps: number[] = [];
      for (let i = 1; i < completedSessions.length && i < 50; i++) {
        const gap = (new Date(completedSessions[i - 1].training_date).getTime() -
          new Date(completedSessions[i].training_date).getTime()) / day;
        if (gap > 0) gaps.push(gap);
      }
      const avg_gap_days = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 999;
      const max_gap_days = gaps.length ? Math.max(...gaps) : 999;

      // Session trend (slope of sessions per week over last 12 weeks)
      const weekBuckets: number[] = Array(12).fill(0);
      for (const s of completedSessions) {
        const weeksAgo = Math.floor((nowMs - new Date(s.training_date).getTime()) / (7 * day));
        if (weeksAgo >= 0 && weeksAgo < 12) weekBuckets[weeksAgo]++;
      }
      // Simple linear regression slope
      const n = weekBuckets.length;
      const xMean = (n - 1) / 2;
      const yMean = weekBuckets.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (weekBuckets[i] - yMean);
        den += (i - xMean) ** 2;
      }
      const session_trend = den ? num / den : 0; // negative = declining (recent weeks = index 0)

      const cancellation_rate = clientSessions.length > 0
        ? cancelledSessions.length / clientSessions.length : 0;

      const no_show_count = clientSessions.filter((s: any) =>
        s.status?.toLowerCase().includes("no show") || s.status?.toLowerCase().includes("noshow")
      ).length;

      // Time slot preference
      const timeSlots = completedSessions.map((s: any) => s.time_slot).filter(Boolean);
      const slotCounts: Record<string, number> = {};
      for (const t of timeSlots) { slotCounts[t] = (slotCounts[t] || 0) + 1; }
      const preferred_time_slot = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // Weekend vs weekday
      let weekendCount = 0, weekdayCount = 0;
      for (const s of completedSessions) {
        const d = new Date(s.training_date).getDay();
        if (d === 0 || d === 6) weekendCount++; else weekdayCount++;
      }
      const weekend_vs_weekday_ratio = weekdayCount > 0 ? weekendCount / weekdayCount : 0;

      // Package features
      const remaining_pct = pkg.pack_size > 0 ? pkg.remaining_sessions / pkg.pack_size : 0;
      const burn_rate = pkg.sessions_per_week ?? 0;
      const days_to_depletion = burn_rate > 0 ? (pkg.remaining_sessions / burn_rate) * 7 : 999;
      const days_to_expiry = pkg.expiry_date
        ? Math.max(0, (new Date(pkg.expiry_date).getTime() - nowMs) / day) : 999;

      // Engagement features
      const days_since_last_session = completedSessions.length > 0
        ? Math.floor((nowMs - new Date(completedSessions[0].training_date).getTime()) / day) : 999;

      const clientCallsSorted = clientCalls.sort((a: any, b: any) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
      const days_since_last_call = clientCallsSorted.length > 0
        ? Math.floor((nowMs - new Date(clientCallsSorted[0].started_at).getTime()) / day) : 999;

      const futureSessions = clientSessions.filter((s: any) =>
        new Date(s.training_date).getTime() > nowMs && !s.status?.toLowerCase().includes("cancel")
      );
      const future_bookings = futureSessions.length;

      const bookingLeadTimes = futureSessions.map((s: any) =>
        (new Date(s.training_date).getTime() - nowMs) / day
      );
      const booking_lead_time_avg = bookingLeadTimes.length
        ? bookingLeadTimes.reduce((a, b) => a + b, 0) / bookingLeadTimes.length : 0;

      // Financial features
      const total_paid = pkg.package_value ?? 0;
      const months_as_customer = contact?.created_at
        ? Math.max(1, (nowMs - new Date(contact.created_at).getTime()) / (30 * day)) : 1;

      // Coach features
      const coaches = [...new Set(clientSessions.map((s: any) => s.coach_name).filter(Boolean))];
      const coach_change_count = Math.max(0, coaches.length - 1);
      const firstSessionDate = completedSessions.length > 0
        ? new Date(completedSessions[completedSessions.length - 1].training_date) : null;
      const coach_tenure = firstSessionDate
        ? Math.floor((nowMs - firstSessionDate.getTime()) / day) : 0;

      // Consistency score (stdev of gaps)
      const consistency_score = gaps.length > 1
        ? Math.sqrt(gaps.reduce((sum, g) => sum + (g - avg_gap_days) ** 2, 0) / gaps.length)
        : 0;

      // Momentum velocity & acceleration
      const recent4w = weekBuckets.slice(0, 4).reduce((a, b) => a + b, 0);
      const prev4w = weekBuckets.slice(4, 8).reduce((a, b) => a + b, 0);
      const oldest4w = weekBuckets.slice(8, 12).reduce((a, b) => a + b, 0);
      const momentum_velocity = recent4w - prev4w;
      const momentum_acceleration = (recent4w - prev4w) - (prev4w - oldest4w);

      // Deal features
      const wonDeals = clientDeals.filter((d: any) => d.stage?.toLowerCase().includes("won") || d.stage?.toLowerCase().includes("closed"));
      const lostDeals = clientDeals.filter((d: any) => d.stage?.toLowerCase().includes("lost"));

      const featureObj = {
        // Session
        sessions_7d, sessions_30d, sessions_90d, session_trend,
        avg_gap_days: Math.round(avg_gap_days * 10) / 10,
        max_gap_days: Math.round(max_gap_days * 10) / 10,
        cancellation_rate: Math.round(cancellation_rate * 1000) / 1000,
        no_show_count,
        preferred_time_slot,
        total_completed_sessions: completedSessions.length,
        // Package
        remaining_pct: Math.round(remaining_pct * 1000) / 1000,
        remaining_sessions: pkg.remaining_sessions,
        pack_size: pkg.pack_size,
        burn_rate: Math.round(burn_rate * 100) / 100,
        days_to_depletion: Math.round(days_to_depletion),
        days_to_expiry: Math.round(days_to_expiry),
        package_value: total_paid,
        // Engagement
        days_since_last_session,
        days_since_last_call,
        future_bookings,
        booking_lead_time_avg: Math.round(booking_lead_time_avg * 10) / 10,
        // Financial
        total_paid,
        months_as_customer: Math.round(months_as_customer * 10) / 10,
        // Coach
        coach_tenure,
        coach_change_count,
        coach_name: pkg.last_coach,
        // Behavioral
        weekend_vs_weekday_ratio: Math.round(weekend_vs_weekday_ratio * 100) / 100,
        consistency_score: Math.round(consistency_score * 10) / 10,
        momentum_velocity,
        momentum_acceleration,
        // Deal history
        deals_won: wonDeals.length,
        deals_lost: lostDeals.length,
        total_deal_value: clientDeals.reduce((s: number, d: any) => s + (d.amount || d.deal_value || 0), 0),
      };

      features.push({
        client_email: email,
        client_name: pkg.client_name,
        coach_name: pkg.last_coach,
        features: featureObj,
        feature_count: Object.keys(featureObj).length,
        computed_at: now.toISOString(),
      });
    }

    // 4. Deduplicate by email (keep latest package)
    const deduped = new Map<string, any>();
    for (const f of features) {
      deduped.set(f.client_email, f);
    }
    const uniqueFeatures = [...deduped.values()];

    // 5. Upsert to ml_client_features in batches
    for (let i = 0; i < uniqueFeatures.length; i += 50) {
      const batch = uniqueFeatures.slice(i, i + 50);
      const { error: upsertError } = await sb
        .from("ml_client_features")
        .upsert(batch, { onConflict: "client_email" });
      if (upsertError) throw new Error(`Upsert failed: ${upsertError.message} | ${upsertError.details} | ${upsertError.hint}`);
    }

    return new Response(JSON.stringify({
      success: true,
      clients_processed: uniqueFeatures.length,
      avg_feature_count: Math.round(uniqueFeatures.reduce((s, f) => s + f.feature_count, 0) / uniqueFeatures.length),
      sample: uniqueFeatures[0]?.features,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message ?? JSON.stringify(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
