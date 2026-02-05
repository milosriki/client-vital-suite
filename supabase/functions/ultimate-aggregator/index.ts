import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// Mock Data Generator for "God Mode" (until live APIs are fully mapped)
// This structure matches the "3-Layer" Architecture requirements.

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // 1. Executive Truth (Top Layer)
    // Real-time calculation of the "Triangle"
    const executiveTruth = {
      meta_spend: 14500, // Mock: $14.5k spend
      hubspot_revenue: 42000, // Mock: $42k revenue
      true_roas: 2.89,
      discrepancy_count: 5,
    };

    // 2. Performance Matrix (Middle Layer)
    // Aggregated by Creative / Campaign
    const creatives = [
      {
        id: "vid_hook_01",
        thumbnail:
          "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=150&q=80",
        name: "Video A: 'Stop Guessing'",
        spend: 5200,
        impressions: 140000,
        clicks: 2100,
        leads: 145,
        deals: 12,
        revenue: 15000,
        roas: 2.88,
        status: "active",
        optimization: {
          status: "optimized",
          action: "SCALE",
          reason: "High ROAS (>2.5x) and low CPA.",
        },
      },
      {
        id: "vid_hook_02",
        thumbnail:
          "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=150&q=80",
        name: "Video B: 'The Truth'",
        spend: 3100,
        impressions: 90000,
        clicks: 1200,
        leads: 55,
        deals: 2,
        revenue: 3000,
        roas: 0.96,
        status: "warning",
        optimization: {
          status: "critical",
          action: "KILL",
          reason: "Burning cash. ROAS < 1.0. Stop immediately.",
        },
      },
      {
        id: "img_carousel_01",
        thumbnail:
          "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&q=80",
        name: "Carousel: Success Stories",
        spend: 6200,
        impressions: 180000,
        clicks: 3400,
        leads: 210,
        deals: 28,
        revenue: 24000,
        roas: 3.87,
        status: "winner",
        optimization: {
          status: "optimized",
          action: "SCALE HARD",
          reason: "Unicorn Creative. 3.8x ROAS. Increase budget +20%.",
        },
      },
    ];

    // 3. Atomic Ledger (Bottom Layer)
    // Raw Drill-down Data
    const atomicLedger = Array.from({ length: 50 }).map((_, i) => ({
      id: `cnt_${1000 + i}`,
      name:
        i % 3 === 0
          ? "Ahmed Al-Mansouri"
          : i % 2 === 0
            ? "Sarah Smith"
            : "John Doe",
      location:
        i % 4 === 0 ? "Dubai, UAE" : i % 5 === 0 ? "Riyadh, KSA" : "London, UK",
      source: "Instagram / Stories",
      creative_id: i % 3 === 0 ? "vid_hook_01" : "img_carousel_01",
      stage: i % 10 === 0 ? "Closed Won" : "Presentation Scheduled",
      value: i % 10 === 0 ? 5000 : 0,
      journey_length: `${2 + (i % 5)} days`,
      last_active: "2 hours ago",
    }));

    const responseData = {
      executive_truth: executiveTruth,
      performance_matrix: {
        creatives: creatives,
        ad_sets: [], // To be implemented
        locations: [], // To be implemented
      },
      atomic_ledger: atomicLedger,
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
