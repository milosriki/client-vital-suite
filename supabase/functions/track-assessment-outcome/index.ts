import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

/**
 * Track Assessment Outcome
 *
 * Closes the attribution loop by matching completed AWS assessments
 * back to their original Facebook ad creative via the attribution_events chain.
 *
 * Flow:
 *   1. Query AWS truth data for completed assessments (last 7 days)
 *   2. Match each completed assessment email → attribution_events
 *   3. Insert "assessment_completed" or "assessment_ghosted" events
 *   4. This enables: Ghost Rate per Creative, True CPA per Creative
 *
 * Cron: Daily at 03:30 UAE (after aws-truth-alignment at 03:00)
 */

const handler = async (req: Request): Promise<Response> => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  }

  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { days_back = 7 } = await req.json().catch(() => ({}));

    // 1. Get all booked assessments (deal stage = assessment) from last N days
    const { data: bookedAssessments, error: bookErr } = await supabase
      .from("deals")
      .select("hubspot_contact_id, deal_name, created_at")
      .or("deal_name.ilike.%assessment%,deal_name.ilike.%intro%")
      .gte(
        "created_at",
        new Date(Date.now() - days_back * 86400000).toISOString(),
      );

    if (bookErr) {
      console.error(
        "[track-assessment] Failed to query booked assessments:",
        bookErr,
      );
      throw bookErr;
    }

    // 2. Get matching contacts (email bridge)
    const contactIds = (bookedAssessments || [])
      .map((d: any) => d.hubspot_contact_id)
      .filter(Boolean);

    if (contactIds.length === 0) {
      return apiSuccess({
        message: "No booked assessments found in period",
        days_back,
        processed: 0,
      });
    }

    const { data: contacts, error: contactErr } = await supabase
      .from("contacts")
      .select("email, hubspot_contact_id")
      .in("hubspot_contact_id", contactIds);

    if (contactErr) {
      console.error("[track-assessment] Failed to query contacts:", contactErr);
      throw contactErr;
    }

    const emailToContactId = new Map<string, string>();
    (contacts || []).forEach((c: any) => {
      if (c.email)
        emailToContactId.set(c.email.toLowerCase(), c.hubspot_contact_id);
    });

    // 3. Check which emails have completed assessments in AWS truth data
    // (Uses the data already synced by aws-truth-alignment)
    const emails = Array.from(emailToContactId.keys());

    const { data: awsTruth, error: awsErr } = await supabase
      .from("aws_truth_cache")
      .select("email, outstanding_sessions, total_purchased")
      .in("email", emails);

    // Build set of emails that have AWS records (= attended)
    const attendedEmails = new Set<string>();
    (awsTruth || []).forEach((record: any) => {
      if (record.email) {
        attendedEmails.add(record.email.toLowerCase());
      }
    });

    // 4. Get existing attribution data for these emails
    const { data: attributions } = await supabase
      .from("attribution_events")
      .select("user_email, fb_ad_id, fb_adset_id, campaign")
      .in("user_email", emails);

    const emailToAttribution = new Map<string, any>();
    (attributions || []).forEach((a: any) => {
      if (a.user_email) {
        emailToAttribution.set(a.user_email.toLowerCase(), a);
      }
    });

    // 5. Create outcome events
    let completed = 0;
    let ghosted = 0;
    let errors = 0;

    for (const email of emails) {
      const attended = attendedEmails.has(email);
      const attribution = emailToAttribution.get(email);

      const eventRecord = {
        event_id: `assessment_${attended ? "completed" : "ghosted"}_${email}_${Date.now()}`,
        event_name: attended ? "assessment_completed" : "assessment_ghosted",
        event_time: new Date().toISOString(),
        source: "track-assessment-outcome",
        user_data: { em: email },
        custom: {
          fb_ad_id: attribution?.fb_ad_id || null,
          fb_adset_id: attribution?.fb_adset_id || null,
          campaign: attribution?.campaign || null,
        },
        meta: {
          hubspot_contact_id: emailToContactId.get(email) || null,
          tracking_group: "assessment_outcome",
        },
      };

      const { error: insertErr } = await supabase
        .from("events")
        .upsert(eventRecord, { onConflict: "event_id,source" });

      if (insertErr) {
        console.error(
          `[track-assessment] Failed to insert event for ${email}:`,
          insertErr,
        );
        errors++;
      } else if (attended) {
        completed++;
      } else {
        ghosted++;
      }
    }

    structuredLog(
      "track-assessment-outcome",
      "info",
      "Assessment outcomes tracked",
      {
        total_booked: emails.length,
        completed,
        ghosted,
        errors,
        ghost_rate_pct:
          emails.length > 0
            ? ((ghosted / emails.length) * 100).toFixed(1)
            : "0",
      },
    );

    return apiSuccess({
      success: true,
      total_booked: emails.length,
      assessment_completed: completed,
      assessment_ghosted: ghosted,
      ghost_rate_pct:
        emails.length > 0
          ? Number(((ghosted / emails.length) * 100).toFixed(1))
          : 0,
      errors,
      days_back,
    });
  } catch (error: unknown) {
    return handleError(error, "track-assessment-outcome", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
};

serve(
  withTracing(handler, {
    functionName: "track-assessment-outcome",
    runType: "chain",
    tags: ["marketing", "attribution", "assessment"],
  }),
);
