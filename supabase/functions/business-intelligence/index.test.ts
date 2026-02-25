import {
  assertEquals,
  assertStringIncludes,
} from "std/testing/asserts.ts";

// ============================================================================
// business-intelligence — daily_summary race condition regression tests
//
// These tests enforce the architectural constraint that business-intelligence
// must NOT write to daily_summary. The daily-report function is the single
// canonical writer. Having two functions upsert to the same row on the same
// date causes a silent race condition where one write overwrites the other.
// ============================================================================

const SOURCE = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

Deno.test(
  "business-intelligence does NOT upsert to daily_summary",
  () => {
    const hasUpsert =
      SOURCE.includes('from("daily_summary").upsert') ||
      SOURCE.includes("from('daily_summary').upsert");
    assertEquals(
      hasUpsert,
      false,
      "business-intelligence must not write to daily_summary — daily-report is the canonical writer",
    );
  },
);

Deno.test(
  "business-intelligence does NOT reference daily_summary in any write operation",
  () => {
    // Also guard against .insert() or .update() on daily_summary
    const lines = SOURCE.split("\n");
    const writesToDailySummary = lines.filter((line) => {
      const looksLikeWrite =
        line.includes("daily_summary") &&
        (line.includes(".upsert") ||
          line.includes(".insert") ||
          line.includes(".update") ||
          line.includes(".delete"));
      // Exclude comment lines
      return looksLikeWrite && !line.trimStart().startsWith("//");
    });
    assertEquals(
      writesToDailySummary.length,
      0,
      `Found unexpected daily_summary writes: ${writesToDailySummary.join("\n")}`,
    );
  },
);

Deno.test(
  "business-intelligence has canonical-writer comment documenting the design decision",
  () => {
    assertStringIncludes(
      SOURCE,
      "daily-report",
      "Source should reference daily-report as the canonical daily_summary writer",
    );
    assertStringIncludes(
      SOURCE,
      "daily_summary",
      "Source should mention daily_summary (in the comment) so the intent is clear",
    );
  },
);

Deno.test(
  "business-intelligence still writes to sync_logs (its own audit trail)",
  () => {
    assertStringIncludes(
      SOURCE,
      'from("sync_logs").insert',
      "business-intelligence should log its own completion to sync_logs",
    );
  },
);
