import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CLEANUP FAKE CONTACTS AGENT
// Removes test, fake, and invalid contact data
// Cleans up orphaned records across all tables
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Comprehensive list of fake email patterns
const FAKE_EMAIL_PATTERNS = [
  "%@email.com",
  "%@example.com",
  "%@test.com",
  "%@fake.com",
  "%@dummy.com",
  "%@sample.com",
  "%@testing.com",
  "%@localhost%",
  "test%@%",
  "fake%@%",
  "dummy%@%",
  "sample%@%",
  "noreply%@%",
  "no-reply%@%",
  "%@mailinator.com",
  "%@guerrillamail.com",
  "%@10minutemail.com",
  "%@tempmail.com",
  "%@throwaway.email"
];

// Specific known fake emails
const KNOWN_FAKE_EMAILS = [
  "test123@gmail.com",
  "test@fb.com",
  "test@marko.com",
  "admin@test.com",
  "user@test.com",
  "contact@example.com",
  "info@example.com",
  "hello@example.com",
  "test@test.test",
  "fake@fake.fake"
];

interface CleanupResult {
  table: string;
  pattern: string;
  deleted_count: number;
  sample_records: string[];
}

interface OrphanedResult {
  table: string;
  description: string;
  deleted_count: number;
}

async function cleanupTableByPatterns(
  supabase: any,
  tableName: string,
  patterns: string[]
): Promise<CleanupResult[]> {
  const results: CleanupResult[] = [];

  for (const pattern of patterns) {
    try {
      const { data: deleted, error } = await supabase
        .from(tableName)
        .delete()
        .ilike("email", pattern)
        .select("id, email")
        .limit(100);

      if (!error && deleted && deleted.length > 0) {
        results.push({
          table: tableName,
          pattern,
          deleted_count: deleted.length,
          sample_records: deleted.slice(0, 5).map((d: any) => d.email)
        });
        console.log(`[Cleanup] ${tableName}: Deleted ${deleted.length} records matching ${pattern}`);
      }
    } catch (error) {
      console.error(`[Cleanup] Error deleting from ${tableName} with pattern ${pattern}:`, error);
    }
  }

  return results;
}

async function cleanupSpecificEmails(
  supabase: any,
  tableName: string,
  emails: string[]
): Promise<CleanupResult | null> {
  try {
    const { data: deleted, error } = await supabase
      .from(tableName)
      .delete()
      .in("email", emails)
      .select("id, email");

    if (!error && deleted && deleted.length > 0) {
      console.log(`[Cleanup] ${tableName}: Deleted ${deleted.length} specific fake emails`);
      return {
        table: tableName,
        pattern: "specific_known_fakes",
        deleted_count: deleted.length,
        sample_records: deleted.slice(0, 5).map((d: any) => d.email)
      };
    }
  } catch (error) {
    console.error(`[Cleanup] Error deleting specific emails from ${tableName}:`, error);
  }

  return null;
}

async function cleanupOldTestData(
  supabase: any,
  tableName: string,
  cutoffDate: string
): Promise<CleanupResult | null> {
  try {
    const { data: deleted, error } = await supabase
      .from(tableName)
      .delete()
      .ilike("email", "test%@%")
      .lt("created_at", cutoffDate)
      .select("id, email");

    if (!error && deleted && deleted.length > 0) {
      console.log(`[Cleanup] ${tableName}: Deleted ${deleted.length} old test records before ${cutoffDate}`);
      return {
        table: tableName,
        pattern: `test_before_${cutoffDate}`,
        deleted_count: deleted.length,
        sample_records: deleted.slice(0, 5).map((d: any) => d.email)
      };
    }
  } catch (error) {
    console.error(`[Cleanup] Error deleting old test data from ${tableName}:`, error);
  }

  return null;
}

async function cleanupOrphanedRecords(supabase: any): Promise<OrphanedResult[]> {
  const results: OrphanedResult[] = [];

  try {
    // Clean up intervention_log for non-existent clients
    const { data: healthEmails } = await supabase
      .from("client_health_scores")
      .select("email");

    if (healthEmails) {
      const validEmails = new Set(healthEmails.map((h: any) => h.email?.toLowerCase()));

      // Get interventions to check
      const { data: interventions } = await supabase
        .from("intervention_log")
        .select("id, client_email")
        .limit(1000);

      if (interventions) {
        const orphanedIds = interventions
          .filter((i: any) => i.client_email && !validEmails.has(i.client_email.toLowerCase()))
          .map((i: any) => i.id);

        if (orphanedIds.length > 0) {
          const { error } = await supabase
            .from("intervention_log")
            .delete()
            .in("id", orphanedIds);

          if (!error) {
            results.push({
              table: "intervention_log",
              description: "Interventions for non-existent clients",
              deleted_count: orphanedIds.length
            });
            console.log(`[Cleanup] Deleted ${orphanedIds.length} orphaned interventions`);
          }
        }
      }
    }

    // Clean up CAPI events with failed status older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: deletedCAPI, error: capiError } = await supabase
      .from("capi_events_enriched")
      .delete()
      .eq("send_status", "failed")
      .lt("created_at", thirtyDaysAgo)
      .select("id");

    if (!capiError && deletedCAPI && deletedCAPI.length > 0) {
      results.push({
        table: "capi_events_enriched",
        description: "Failed CAPI events older than 30 days",
        deleted_count: deletedCAPI.length
      });
      console.log(`[Cleanup] Deleted ${deletedCAPI.length} old failed CAPI events`);
    }

    // Clean up old completed interventions (older than 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: deletedInterventions, error: intError } = await supabase
      .from("intervention_log")
      .delete()
      .eq("status", "COMPLETED")
      .lt("triggered_at", ninetyDaysAgo)
      .select("id");

    if (!intError && deletedInterventions && deletedInterventions.length > 0) {
      results.push({
        table: "intervention_log",
        description: "Completed interventions older than 90 days",
        deleted_count: deletedInterventions.length
      });
      console.log(`[Cleanup] Deleted ${deletedInterventions.length} old completed interventions`);
    }

  } catch (error) {
    console.error("[Cleanup] Error cleaning orphaned records:", error);
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[Cleanup] Starting cleanup of fake and test data...");

    const allResults: CleanupResult[] = [];

    // Tables to clean
    const tablesToClean = ["contacts", "leads", "enhanced_leads", "client_health_scores"];

    // Clean by patterns
    for (const table of tablesToClean) {
      const patternResults = await cleanupTableByPatterns(supabase, table, FAKE_EMAIL_PATTERNS);
      allResults.push(...patternResults);
    }

    // Clean specific known fakes
    for (const table of tablesToClean) {
      const specificResult = await cleanupSpecificEmails(supabase, table, KNOWN_FAKE_EMAILS);
      if (specificResult) {
        allResults.push(specificResult);
      }
    }

    // Clean old test data (before 2023)
    for (const table of tablesToClean) {
      const oldTestResult = await cleanupOldTestData(supabase, table, "2023-01-01");
      if (oldTestResult) {
        allResults.push(oldTestResult);
      }
    }

    // Clean orphaned records
    const orphanedResults = await cleanupOrphanedRecords(supabase);

    const totalDeleted = allResults.reduce((sum, r) => sum + r.deleted_count, 0);
    const totalOrphaned = orphanedResults.reduce((sum, r) => sum + r.deleted_count, 0);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      fake_data_cleanup: {
        tables_processed: tablesToClean,
        patterns_checked: FAKE_EMAIL_PATTERNS.length,
        total_deleted: totalDeleted,
        by_table: allResults.reduce((acc, r) => {
          if (!acc[r.table]) acc[r.table] = 0;
          acc[r.table] += r.deleted_count;
          return acc;
        }, {} as Record<string, number>),
        details: allResults
      },
      orphaned_data_cleanup: {
        total_deleted: totalOrphaned,
        details: orphanedResults
      },
      summary: {
        total_records_deleted: totalDeleted + totalOrphaned,
        fake_data_deleted: totalDeleted,
        orphaned_data_deleted: totalOrphaned
      }
    };

    console.log(`[Cleanup] Complete in ${result.duration_ms}ms - Deleted ${result.summary.total_records_deleted} total records`);

    // Log the cleanup operation
    await supabase.from("sync_logs").insert({
      platform: "cleanup",
      sync_type: "fake_data_cleanup",
      status: "success",
      records_processed: result.summary.total_records_deleted,
      records_failed: 0,
      error_details: result,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: result.duration_ms
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[Cleanup] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
