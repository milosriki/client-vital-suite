import {
  assertEquals,
  assertStringIncludes,
} from "std/testing/asserts.ts";

// ============================================================================
// daily-report — daily_summary canonical writer tests
//
// Verifies that daily-report is the ONLY canonical writer to daily_summary,
// with the correct conflict resolution key and required payload fields.
// ============================================================================

const SOURCE = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

Deno.test(
  "daily-report upserts to daily_summary",
  () => {
    assertStringIncludes(
      SOURCE,
      'from("daily_summary").upsert',
      "daily-report must write to daily_summary",
    );
  },
);

Deno.test(
  "daily-report uses summary_date as the conflict key",
  () => {
    assertStringIncludes(
      SOURCE,
      'onConflict: "summary_date"',
      "upsert must conflict on summary_date to prevent duplicate rows per day",
    );
  },
);

Deno.test(
  "daily-report upsert payload contains required health-zone fields",
  () => {
    // All zone counts must be present — they are the primary reason the report
    // exists and would be zeroed out by a BI race-write if absent.
    const requiredFields = [
      "summary_date",
      "total_clients",
      "avg_health_score",
      "red_count",
      "yellow_count",
      "green_count",
      "purple_count",
      "total_at_risk",
      "at_risk_revenue_aed",
      "zone_changes_24h",
      "top_risks",
      "patterns_detected",
      "generated_at",
    ];
    for (const field of requiredFields) {
      assertStringIncludes(
        SOURCE,
        field,
        `daily_summary upsert payload is missing required field: ${field}`,
      );
    }
  },
);

Deno.test(
  "daily-report is the sole function that writes daily_summary (cross-check with BI source)",
  async () => {
    const biSource = await Deno.readTextFile(
      new URL("../business-intelligence/index.ts", import.meta.url),
    );
    const biHasUpsert =
      biSource.includes('from("daily_summary").upsert') ||
      biSource.includes("from('daily_summary').upsert");
    assertEquals(
      biHasUpsert,
      false,
      "business-intelligence must not upsert to daily_summary — race condition risk",
    );
  },
);
