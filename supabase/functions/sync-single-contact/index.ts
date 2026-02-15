import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

const HUBSPOT_CONTACT_PROPERTIES = [
  // Identity & Basic Info
  'firstname', 'lastname', 'email', 'phone', 'mobilephone', 'jobtitle',
  'hs_object_id', 'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
  'createdate', 'lastmodifieddate', 'city', 'state', 'country',
  // Attribution & Traffic Sources
  'hs_analytics_source', 'hs_analytics_source_data_1',
  'hs_analytics_first_touch_converting_campaign',
  'hs_analytics_last_touch_converting_campaign',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'hs_analytics_first_url', 'hs_analytics_last_url',
  // Lead Management
  'num_contacted_notes', 'custom_lifecycle_stage', 'first_conversion_date',
  'num_form_submissions', 'num_unique_forms_submitted',
  'recent_conversion_event_name', 'recent_conversion_date',
  'hubspot_team_id', 'hs_sa_first_engagement_descr',
  'hs_date_entered_lead', 'contact_unworked', 'hs_is_unworked',
  'hs_last_sales_activity_date', 'hs_email_domain',
  // Company Information
  'company', 'company_name', 'company_size', 'industry', 'website', 'domain',
  // Deal & Revenue
  'num_associated_deals', 'total_revenue',
  // Analytics & Engagement
  'hs_analytics_num_visits', 'hs_analytics_num_page_views',
  'hs_analytics_num_event_completions', 'hs_analytics_score',
  'hs_analytics_first_visit', 'hs_analytics_last_visit',
  // Engagement Metrics
  'hs_social_facebook_clicks', 'hs_social_twitter_clicks', 'hs_social_linkedin_clicks',
  'num_notes', 'num_meetings', 'num_emails', 'num_emails_sent',
  'num_emails_opened', 'num_emails_clicked',
  'notes_last_contacted', 'notes_last_contacted_date',
  'hs_last_meeting_booked_date', 'hs_next_activity_date',
  // Communication Preferences
  'hs_email_opt_out', 'hs_marketing_opt_out', 'preferred_contact_method',
  'timezone', 'language',
  // Social Media
  'twitterhandle', 'linkedinbio', 'linkedinconnections', 'twitterfollowers',
  // PTD-specific Custom Properties
  'assigned_coach', 'assessment_scheduled', 'assessment_date',
  'package_type', 'sessions_purchased', 'outstanding_sessions',
  'coach_notes', 'preferred_location', 'fitness_goals', 'call_status',
  'of_sessions_conducted__last_7_days_',
  'of_conducted_sessions__last_30_days_',
  'of_sessions_conducted__last_90_days_',
  'next_session_is_booked',
  'of_future_booked_sessions',
  'last_package_cost',
];

serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY) throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { objectId } = await req.json();

    if (!objectId) throw new Error("objectId (Contact ID) is required");

    console.log(`[Sync-Single-Contact] Processing Contact ID: ${objectId}`);

    // Fetch all 66 properties from HubSpot
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${objectId}?properties=${HUBSPOT_CONTACT_PROPERTIES.join(",")}`,
      { headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` } },
    );

    if (!response.ok) {
      if (response.status === 404)
        return apiError("INTERNAL_ERROR", JSON.stringify({ message: "Contact not found" }));
      throw new Error(`HubSpot API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const p = data.properties;

    // Gap I FIX: Use explicit null checks instead of `|| null` pattern
    // OLD: `p.email || null` — converts "" and 0 to null (corrections never sync)
    // NEW: `nullIfAbsent(p.email)` — keeps "" and 0 as real values, only strips
    //       null/undefined (HubSpot API returns null for truly empty fields)
    const nullIfAbsent = (v: unknown) => v === null || v === undefined ? undefined : v;
    const toNum = (v: unknown) => {
      if (v === null || v === undefined) return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n; // 0 passes through (Gap I fix)
    };

    // Map HubSpot properties -> Supabase contacts columns
    // Column names verified against contacts table schema (122 columns)
    const contactData: Record<string, unknown> = {
      hubspot_contact_id: String(objectId),
      // Identity — nullIfAbsent preserves "" for cleared fields
      email: nullIfAbsent(p.email),
      first_name: nullIfAbsent(p.firstname),
      last_name: nullIfAbsent(p.lastname),
      phone: nullIfAbsent(p.phone) ?? nullIfAbsent(p.mobilephone),
      job_title: nullIfAbsent(p.jobtitle),  // FIX: was "position" (wrong column)
      city: nullIfAbsent(p.city),
      // NOTE: contacts table has NO "country" column — skip it
      lifecycle_stage: nullIfAbsent(p.lifecyclestage),
      lead_status: nullIfAbsent(p.hs_lead_status),
      owner_id: nullIfAbsent(p.hubspot_owner_id),  // FIX: was "hubspot_owner_id" (wrong column)
      // Timestamps
      created_at: p.createdate ? new Date(p.createdate).toISOString() : new Date().toISOString(),
      updated_at: p.lastmodifieddate ? new Date(p.lastmodifieddate).toISOString() : new Date().toISOString(),
      // Attribution & Traffic — THE KEY MARKETING DATA
      first_touch_source: nullIfAbsent(p.hs_analytics_source),
      latest_traffic_source: nullIfAbsent(p.hs_analytics_source_data_1),
      utm_source: nullIfAbsent(p.utm_source),
      utm_medium: nullIfAbsent(p.utm_medium),
      utm_campaign: nullIfAbsent(p.utm_campaign),
      utm_content: nullIfAbsent(p.utm_content),
      utm_term: nullIfAbsent(p.utm_term),
      first_page_seen: nullIfAbsent(p.hs_analytics_first_url),
      last_page_seen: nullIfAbsent(p.hs_analytics_last_url),
      // Lead Management
      custom_lifecycle_stage: nullIfAbsent(p.custom_lifecycle_stage),
      first_conversion_date: nullIfAbsent(p.first_conversion_date),
      num_form_submissions: toNum(p.num_form_submissions),
      num_unique_forms_submitted: toNum(p.num_unique_forms_submitted),
      recent_conversion: nullIfAbsent(p.recent_conversion_event_name),
      recent_conversion_date: nullIfAbsent(p.recent_conversion_date),
      hubspot_team: nullIfAbsent(p.hubspot_team_id),
      contact_unworked: p.contact_unworked === 'true' || p.hs_is_unworked === 'true' || false,
      last_activity_date: nullIfAbsent(p.hs_last_sales_activity_date),
      email_domain: nullIfAbsent(p.hs_email_domain),
      // Company
      company_name: nullIfAbsent(p.company) ?? nullIfAbsent(p.company_name),
      company_size: nullIfAbsent(p.company_size),
      industry: nullIfAbsent(p.industry),
      website: nullIfAbsent(p.website),
      company_domain: nullIfAbsent(p.domain),
      // Deal & Revenue — toNum preserves 0 (Gap I: cleared revenue = 0, not ignored)
      num_associated_deals: toNum(p.num_associated_deals),
      total_value: toNum(p.total_revenue),
      // Analytics
      num_visits: toNum(p.hs_analytics_num_visits),
      num_page_views: toNum(p.hs_analytics_num_page_views),
      num_event_completions: toNum(p.hs_analytics_num_event_completions),
      analytics_score: toNum(p.hs_analytics_score),
      first_visit_date: nullIfAbsent(p.hs_analytics_first_visit),
      last_visit_date: nullIfAbsent(p.hs_analytics_last_visit),
      // Social Engagement
      facebook_clicks: toNum(p.hs_social_facebook_clicks),
      twitter_clicks: toNum(p.hs_social_twitter_clicks),
      linkedin_clicks: toNum(p.hs_social_linkedin_clicks),
      // Activity Metrics
      num_notes: toNum(p.num_notes),
      num_meetings: toNum(p.num_meetings),
      num_emails: toNum(p.num_emails),
      num_emails_sent: toNum(p.num_emails_sent),
      num_emails_opened: toNum(p.num_emails_opened),
      num_emails_clicked: toNum(p.num_emails_clicked),
      last_meeting_date: nullIfAbsent(p.hs_last_meeting_booked_date),
      next_meeting_date: nullIfAbsent(p.hs_next_activity_date),
      // Communication Preferences
      email_opt_out: p.hs_email_opt_out === 'true',
      marketing_opt_out: p.hs_marketing_opt_out === 'true',
      preferred_contact_method: nullIfAbsent(p.preferred_contact_method),
      timezone: nullIfAbsent(p.timezone),
      language: nullIfAbsent(p.language),
      // Social Media
      twitter_handle: nullIfAbsent(p.twitterhandle),
      linkedin_bio: nullIfAbsent(p.linkedinbio),
      linkedin_connections: toNum(p.linkedinconnections),
      twitter_followers: toNum(p.twitterfollowers),
      // PTD Custom Properties
      assigned_coach: nullIfAbsent(p.assigned_coach),
      assessment_scheduled: p.assessment_scheduled === 'true',
      assessment_date: nullIfAbsent(p.assessment_date),
      package_type: nullIfAbsent(p.package_type),
      sessions_purchased: toNum(p.sessions_purchased),
      outstanding_sessions: toNum(p.outstanding_sessions),
      coach_notes: nullIfAbsent(p.coach_notes),
      preferred_location: nullIfAbsent(p.preferred_location),
      fitness_goals: nullIfAbsent(p.fitness_goals),
      // Session Activity (REAL-TIME from HubSpot) — toNum preserves 0
      sessions_last_7d: toNum(p['of_sessions_conducted__last_7_days_']),
      sessions_last_30d: toNum(p['of_conducted_sessions__last_30_days_']),
      sessions_last_90d: toNum(p['of_sessions_conducted__last_90_days_']),
      next_session_is_booked: p.next_session_is_booked === 'true',
      future_booked_sessions: toNum(p['of_future_booked_sessions']),
      last_package_cost: toNum(p.last_package_cost),
      // Metadata
      last_updated_source: 'hubspot-webhook',
    };

    // Gap I FIX: Only filter out `undefined` (field not in HubSpot response)
    // Keep `null` (field cleared), `0` (numeric reset), `""` (text cleared),
    // and `false` (boolean cleared) — these are intentional corrections
    const cleanedData = Object.fromEntries(
      Object.entries(contactData).filter(([_, v]) => v !== undefined)
    );
    // Always include the conflict key
    cleanedData.hubspot_contact_id = String(objectId);

    const { error } = await supabase
      .from("contacts")
      .upsert(cleanedData, { onConflict: "hubspot_contact_id" });

    if (error) throw error;

    console.log(`[Sync-Single-Contact] Synced contact ${p.email} (${Object.keys(cleanedData).length} fields)`);

    return apiSuccess({ success: true, fields_synced: Object.keys(cleanedData).length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Sync-Single-Contact] Error:", msg);
    return apiSuccess({ error: msg });
  }
});
