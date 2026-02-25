import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { AnalystRecommendationSchema } from "./index.ts";

// ============================================================================
// AnalystRecommendationSchema — unit tests
// ============================================================================

const validRec = {
  ad_id: "act_123_ad_456",
  ad_name: "Dubai Transformation Feb",
  action: "SCALE" as const,
  confidence: 90,
  reasoning: "ROAS 3.4x with 55% show rate",
  metrics: {
    roas_7d: 3.4,
    show_rate: 55.0,
    ghost_rate: 12.5,
    health_avg: 72,
    spend_7d: 1200,
    revenue_7d: 4080,
  },
  signal_id: "sig_abc",
};

Deno.test("AnalystRecommendationSchema - accepts valid recommendation", () => {
  const result = AnalystRecommendationSchema.safeParse(validRec);
  assertEquals(result.success, true);
});

Deno.test("AnalystRecommendationSchema - accepts null ad_name and signal_id", () => {
  const result = AnalystRecommendationSchema.safeParse({
    ...validRec,
    ad_name: null,
    signal_id: null,
  });
  assertEquals(result.success, true);
});

Deno.test("AnalystRecommendationSchema - accepts all valid action values", () => {
  const actions = ["SCALE", "HOLD", "WATCH", "KILL", "REFRESH"] as const;
  for (const action of actions) {
    const result = AnalystRecommendationSchema.safeParse({ ...validRec, action });
    assertEquals(result.success, true, `Action ${action} should be valid`);
  }
});

Deno.test("AnalystRecommendationSchema - rejects missing ad_id", () => {
  const { ad_id: _removed, ...withoutAdId } = validRec;
  const result = AnalystRecommendationSchema.safeParse(withoutAdId);
  assertEquals(result.success, false);
});

Deno.test("AnalystRecommendationSchema - rejects empty ad_id string", () => {
  const result = AnalystRecommendationSchema.safeParse({ ...validRec, ad_id: "" });
  assertEquals(result.success, false);
});

Deno.test("AnalystRecommendationSchema - rejects invalid action", () => {
  const result = AnalystRecommendationSchema.safeParse({ ...validRec, action: "BUY" });
  assertEquals(result.success, false);
});

Deno.test("AnalystRecommendationSchema - rejects confidence > 100", () => {
  const result = AnalystRecommendationSchema.safeParse({ ...validRec, confidence: 101 });
  assertEquals(result.success, false);
});

Deno.test("AnalystRecommendationSchema - rejects confidence < 0", () => {
  const result = AnalystRecommendationSchema.safeParse({ ...validRec, confidence: -1 });
  assertEquals(result.success, false);
});

Deno.test("AnalystRecommendationSchema - rejects non-number roas_7d", () => {
  const result = AnalystRecommendationSchema.safeParse({
    ...validRec,
    metrics: { ...validRec.metrics, roas_7d: "high" },
  });
  assertEquals(result.success, false);
});

Deno.test("AnalystRecommendationSchema - rejects missing metrics fields", () => {
  const { roas_7d: _removed, ...metricsWithout } = validRec.metrics;
  const result = AnalystRecommendationSchema.safeParse({
    ...validRec,
    metrics: metricsWithout,
  });
  assertEquals(result.success, false);
});

Deno.test("AnalystRecommendationSchema - validation error includes path info", () => {
  const result = AnalystRecommendationSchema.safeParse({ ...validRec, action: "INVALID" });
  assertEquals(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join("."));
    assertEquals(paths.includes("action"), true);
  }
});
