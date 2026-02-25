import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ProactiveInsightSchema, ProactiveInsightArraySchema } from "./index.ts";

// ============================================================================
// ProactiveInsightSchema — unit tests (LLM output validation)
// ============================================================================

const validInsight = {
  insight_type: "churn_risk",
  priority: "critical" as const,
  status: "active",
  recommended_action: "5 clients in RED zone. Urgent retention intervention.",
  reason: "Health score critical or high churn probability",
  best_call_time: "Today",
  call_script: "Hi [Name], I noticed we haven't connected in a while...",
};

Deno.test("ProactiveInsightSchema - accepts valid insight", () => {
  const result = ProactiveInsightSchema.safeParse(validInsight);
  assertEquals(result.success, true);
});

Deno.test("ProactiveInsightSchema - accepts all valid priority values", () => {
  const priorities = ["critical", "high", "medium", "low", "info"] as const;
  for (const priority of priorities) {
    const result = ProactiveInsightSchema.safeParse({ ...validInsight, priority });
    assertEquals(result.success, true, `priority ${priority} should be valid`);
  }
});

Deno.test("ProactiveInsightSchema - accepts missing status (optional)", () => {
  const { status: _removed, ...withoutStatus } = validInsight;
  const result = ProactiveInsightSchema.safeParse(withoutStatus);
  assertEquals(result.success, true);
});

Deno.test("ProactiveInsightSchema - rejects missing insight_type", () => {
  const { insight_type: _removed, ...withoutType } = validInsight;
  const result = ProactiveInsightSchema.safeParse(withoutType);
  assertEquals(result.success, false);
});

Deno.test("ProactiveInsightSchema - rejects empty insight_type", () => {
  const result = ProactiveInsightSchema.safeParse({ ...validInsight, insight_type: "" });
  assertEquals(result.success, false);
});

Deno.test("ProactiveInsightSchema - rejects invalid priority", () => {
  const result = ProactiveInsightSchema.safeParse({ ...validInsight, priority: "urgent" });
  assertEquals(result.success, false);
});

Deno.test("ProactiveInsightSchema - rejects missing recommended_action", () => {
  const { recommended_action: _removed, ...withoutAction } = validInsight;
  const result = ProactiveInsightSchema.safeParse(withoutAction);
  assertEquals(result.success, false);
});

Deno.test("ProactiveInsightSchema - rejects empty recommended_action", () => {
  const result = ProactiveInsightSchema.safeParse({ ...validInsight, recommended_action: "" });
  assertEquals(result.success, false);
});

Deno.test("ProactiveInsightSchema - rejects missing reason", () => {
  const { reason: _removed, ...withoutReason } = validInsight;
  const result = ProactiveInsightSchema.safeParse(withoutReason);
  assertEquals(result.success, false);
});

// ── Array schema tests ───────────────────────────────────────────────────────

Deno.test("ProactiveInsightArraySchema - accepts array of valid insights", () => {
  const result = ProactiveInsightArraySchema.safeParse([validInsight, { ...validInsight, insight_type: "sla_breach" }]);
  assertEquals(result.success, true);
});

Deno.test("ProactiveInsightArraySchema - accepts empty array", () => {
  const result = ProactiveInsightArraySchema.safeParse([]);
  assertEquals(result.success, true);
});

Deno.test("ProactiveInsightArraySchema - rejects array with one invalid item", () => {
  const result = ProactiveInsightArraySchema.safeParse([
    validInsight,
    { ...validInsight, priority: "extreme" }, // invalid priority
  ]);
  assertEquals(result.success, false);
});

Deno.test("ProactiveInsightArraySchema - rejects non-array input", () => {
  const result = ProactiveInsightArraySchema.safeParse(validInsight);
  assertEquals(result.success, false);
});

Deno.test("ProactiveInsightArraySchema - validation error includes array index path", () => {
  const result = ProactiveInsightArraySchema.safeParse([
    validInsight,
    { ...validInsight, priority: "wrong" },
  ]);
  assertEquals(result.success, false);
  if (!result.success) {
    // Error path should include index [1] and field "priority"
    const paths = result.error.issues.map((i) => i.path.map(String).join("."));
    assertEquals(paths.some((p) => p.includes("1") && p.includes("priority")), true);
  }
});
