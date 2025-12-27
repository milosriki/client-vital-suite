import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadLossPoint {
  point: string;
  status: "broken" | "partial" | "critical" | "missing" | "inactive" | "ok";
  description: string;
  leadsAffected: string;
  revenueImpact: string;
}

interface Recommendation {
  priority: number;
  title: string;
  description: string;
  effort: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High" | "Critical";
  revenue: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Analyze leads data
    const { data: leads } = await supabase
      .from("enhanced_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    const { data: deals } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: callRecords } = await supabase
      .from("call_records")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    // Calculate metrics
    const totalLeads = leads?.length || 0;
    const totalContacts = contacts?.length || 0;
    const totalDeals = deals?.length || 0;
    const totalCalls = callRecords?.length || 0;

    // Unassigned leads
    const unassignedLeads = leads?.filter(l => !l.owner_email && !l.assigned_to) || [];
    const unassignedRate = totalLeads > 0 ? (unassignedLeads.length / totalLeads) * 100 : 0;

    // Leads without calls (never contacted)
    const leadsWithoutCalls = leads?.filter(l => {
      const hasCalls = callRecords?.some(c => 
        c.contact_email === l.email || 
        c.caller_number?.includes(l.phone?.slice(-8) || "xxx")
      );
      return !hasCalls;
    }) || [];
    const neverCalledRate = totalLeads > 0 ? (leadsWithoutCalls.length / totalLeads) * 100 : 0;

    // Stale leads (no activity > 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const staleLeads = leads?.filter(l => {
      const lastActivity = new Date(l.updated_at || l.created_at || "");
      return lastActivity < sevenDaysAgo && 
             (!l.conversion_status || l.conversion_status === "new");
    }) || [];
    const staleRate = totalLeads > 0 ? (staleLeads.length / totalLeads) * 100 : 0;

    // Premium leads (high-value indicators)
    const premiumLeads = leads?.filter(l => 
      l.location?.toLowerCase().includes("downtown") ||
      l.location?.toLowerCase().includes("marina") ||
      l.location?.toLowerCase().includes("difc") ||
      (l.deal_value && l.deal_value > 10000)
    ) || [];
    const premiumUncontacted = premiumLeads.filter(l => 
      !callRecords?.some(c => c.contact_email === l.email)
    );

    // Data quality issues
    const blankEmails = leads?.filter(l => !l.email || l.email.trim() === "") || [];
    const blankPhones = leads?.filter(l => !l.phone || l.phone.trim() === "") || [];
    const dataQualityIssueRate = totalLeads > 0 
      ? ((blankEmails.length + blankPhones.length) / (totalLeads * 2)) * 100 
      : 0;

    // Deal conversion
    const closedDeals = deals?.filter(d => d.status === "closed" || (d.status as string) === "won") || [];
    const conversionRate = totalDeals > 0 ? (closedDeals.length / totalDeals) * 100 : 0;

    // Stalled deals
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const stalledDeals = deals?.filter(d => {
      const lastUpdate = new Date(d.updated_at || d.created_at || "");
      return lastUpdate < fourteenDaysAgo && 
             d.status !== "closed" && 
             d.status !== "lost" &&
             (d.status as string) !== "won";
    }) || [];

    // Calculate revenue at risk
    const avgDealValue = closedDeals.length > 0 
      ? closedDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0) / closedDeals.length
      : 5000;
    
    const revenueAtRisk = {
      unassigned: Math.round(unassignedLeads.length * avgDealValue * 0.3),
      neverCalled: Math.round(leadsWithoutCalls.length * avgDealValue * 0.25),
      stale: Math.round(staleLeads.length * avgDealValue * 0.2),
      premium: Math.round(premiumUncontacted.length * avgDealValue * 0.5),
      stalled: stalledDeals.reduce((sum, d) => sum + (d.deal_value || avgDealValue), 0),
    };

    // Generate dynamic lead loss points
    const leadLossPoints: LeadLossPoint[] = [
      {
        point: "Initial Assignment",
        status: unassignedRate > 20 ? "broken" : unassignedRate > 10 ? "partial" : "ok",
        description: unassignedRate > 10 
          ? `${unassignedLeads.length} leads (${unassignedRate.toFixed(1)}%) are unassigned`
          : "Lead assignment is working well",
        leadsAffected: `${unassignedLeads.length} leads`,
        revenueImpact: revenueAtRisk.unassigned > 0 ? `${(revenueAtRisk.unassigned / 1000).toFixed(0)}K AED` : "Low"
      },
      {
        point: "First Contact Attempt",
        status: neverCalledRate > 30 ? "critical" : neverCalledRate > 15 ? "broken" : neverCalledRate > 5 ? "partial" : "ok",
        description: neverCalledRate > 5 
          ? `${neverCalledRate.toFixed(1)}% of leads never received a call`
          : "Contact attempts are consistent",
        leadsAffected: `${leadsWithoutCalls.length} leads`,
        revenueImpact: revenueAtRisk.neverCalled > 0 ? `${(revenueAtRisk.neverCalled / 1000).toFixed(0)}K AED` : "Low"
      },
      {
        point: "Lead Follow-up Timing",
        status: staleRate > 40 ? "critical" : staleRate > 20 ? "broken" : staleRate > 10 ? "partial" : "ok",
        description: staleRate > 10 
          ? `${staleLeads.length} leads (${staleRate.toFixed(1)}%) are stale (>7 days no activity)`
          : "Follow-up timing is good",
        leadsAffected: `${staleLeads.length} leads`,
        revenueImpact: revenueAtRisk.stale > 0 ? `${(revenueAtRisk.stale / 1000).toFixed(0)}K AED` : "Low"
      },
      {
        point: "Premium Lead Priority",
        status: premiumUncontacted.length > 10 ? "critical" : premiumUncontacted.length > 5 ? "broken" : premiumUncontacted.length > 0 ? "partial" : "ok",
        description: premiumUncontacted.length > 0 
          ? `${premiumUncontacted.length} high-value leads not contacted`
          : "Premium leads are being prioritized",
        leadsAffected: `${premiumUncontacted.length} premium leads`,
        revenueImpact: revenueAtRisk.premium > 0 ? `${(revenueAtRisk.premium / 1000).toFixed(0)}K AED` : "Low"
      },
      {
        point: "Data Quality",
        status: dataQualityIssueRate > 20 ? "broken" : dataQualityIssueRate > 10 ? "partial" : "ok",
        description: dataQualityIssueRate > 5 
          ? `${blankEmails.length} blank emails, ${blankPhones.length} blank phones`
          : "Data quality is acceptable",
        leadsAffected: `${blankEmails.length + blankPhones.length} records`,
        revenueImpact: dataQualityIssueRate > 10 ? "Wasted capacity" : "Low"
      },
      {
        point: "Deal Pipeline Health",
        status: stalledDeals.length > 20 ? "critical" : stalledDeals.length > 10 ? "broken" : stalledDeals.length > 5 ? "partial" : "ok",
        description: stalledDeals.length > 0 
          ? `${stalledDeals.length} deals stalled for >14 days`
          : "Pipeline is flowing well",
        leadsAffected: `${stalledDeals.length} deals`,
        revenueImpact: revenueAtRisk.stalled > 0 ? `${(revenueAtRisk.stalled / 1000).toFixed(0)}K AED` : "Low"
      }
    ];

    // Generate dynamic recommendations
    const recommendations: Recommendation[] = [];
    let priority = 1;

    // Critical issues first
    if (unassignedRate > 10) {
      recommendations.push({
        priority: priority++,
        title: "Fix Lead Assignment Process",
        description: `${unassignedLeads.length} leads are unassigned. Implement automatic round-robin assignment.`,
        effort: "Medium",
        impact: unassignedRate > 20 ? "Critical" : "High",
        revenue: `${(revenueAtRisk.unassigned / 1000).toFixed(0)}K AED at risk`
      });
    }

    if (neverCalledRate > 15) {
      recommendations.push({
        priority: priority++,
        title: "Contact Unworked Leads",
        description: `${leadsWithoutCalls.length} leads never received a call. Create outbound call campaign.`,
        effort: "High",
        impact: "Critical",
        revenue: `${(revenueAtRisk.neverCalled / 1000).toFixed(0)}K AED potential`
      });
    }

    if (premiumUncontacted.length > 0) {
      recommendations.push({
        priority: priority++,
        title: "Prioritize Premium Leads",
        description: `${premiumUncontacted.length} high-value leads need immediate attention. Contact today.`,
        effort: "Low",
        impact: "High",
        revenue: `${(revenueAtRisk.premium / 1000).toFixed(0)}K AED immediate`
      });
    }

    if (staleRate > 20) {
      recommendations.push({
        priority: priority++,
        title: "Reactivate Stale Leads",
        description: `${staleLeads.length} leads have gone cold. Launch re-engagement campaign.`,
        effort: "Medium",
        impact: "High",
        revenue: `${(revenueAtRisk.stale / 1000).toFixed(0)}K AED recoverable`
      });
    }

    if (stalledDeals.length > 5) {
      recommendations.push({
        priority: priority++,
        title: "Unblock Stalled Deals",
        description: `${stalledDeals.length} deals stuck >14 days. Send break-up emails or escalate.`,
        effort: "Medium",
        impact: "High",
        revenue: `${(revenueAtRisk.stalled / 1000).toFixed(0)}K AED in pipeline`
      });
    }

    if (dataQualityIssueRate > 10) {
      recommendations.push({
        priority: priority++,
        title: "Fix Form Validation",
        description: `${blankEmails.length + blankPhones.length} records have missing data. Add required field validation.`,
        effort: "Low",
        impact: "Medium",
        revenue: "Prevents future data issues"
      });
    }

    // If everything is healthy, add optimization recommendations
    if (recommendations.length < 3) {
      recommendations.push({
        priority: priority++,
        title: "Optimize Conversion Rate",
        description: `Current conversion rate is ${conversionRate.toFixed(1)}%. A/B test follow-up sequences.`,
        effort: "Medium",
        impact: "Medium",
        revenue: "Incremental improvement"
      });
    }

    // Property categories analysis
    const propertyCategories = [
      { category: "Contact Info", count: contacts?.filter(c => c.email && c.phone).length || 0, usage: "Critical", quality: dataQualityIssueRate < 10 ? "Good" : "Needs Improvement" },
      { category: "Lead Source", count: leads?.filter(l => l.source || l.utm_source).length || 0, usage: "High", quality: "Good" },
      { category: "Deal Pipeline", count: deals?.length || 0, usage: "High", quality: conversionRate > 20 ? "Good" : "Medium" },
      { category: "Activity Tracking", count: callRecords?.length || 0, usage: "High", quality: totalCalls > 100 ? "Good" : "Needs More Data" }
    ];

    const result = {
      success: true,
      summary: {
        totalLeads,
        totalContacts,
        totalDeals,
        totalCalls,
        conversionRate: conversionRate.toFixed(1) + "%",
        unassignedRate: unassignedRate.toFixed(1) + "%",
        neverCalledRate: neverCalledRate.toFixed(1) + "%",
        staleRate: staleRate.toFixed(1) + "%",
        dataQualityIssueRate: dataQualityIssueRate.toFixed(1) + "%",
        totalRevenueAtRisk: Object.values(revenueAtRisk).reduce((a, b) => a + b, 0)
      },
      leadLossPoints,
      propertyCategories,
      recommendations: recommendations.slice(0, 6), // Top 6 recommendations
      analyzedAt: new Date().toISOString()
    };

    console.log("HubSpot Analysis complete:", {
      totalLeads,
      issues: leadLossPoints.filter(p => p.status !== "ok").length,
      recommendations: recommendations.length
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("HubSpot analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
