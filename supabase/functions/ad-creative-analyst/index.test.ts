import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { CreativeDNASchema } from "./index.ts";

// ============================================================================
// CreativeDNASchema — unit tests
// ============================================================================

const validCreative = {
  ad_id: "act_123_ad_456",
  ad_name: "Business Bay Transformation",
  campaign_id: "camp_001",
  campaign_name: "Q1 Dubai",
  adset_id: "adset_001",
  adset_name: "Business Bay 35-45",
  total_spend_aed: 2450.75,
  cpa_aed: 245.08,
  cpc_aed: 12.5,
  ctr_pct: 2.34,
  conversion_rate_pct: 8.5,
  frequency: 2.1,
  quality_ranking: "ABOVE_AVERAGE",
  engagement_rate_ranking: "AVERAGE",
  conversion_rate_ranking: "BELOW_AVERAGE",
  video_completion_rate_pct: 65.0,
  fatigue_status: "OK" as const,
  fatigue_reason: "",
  action: "SCALE" as const,
  action_reason: "Strong CTR with 12 leads. Scale budget.",
  priority: 3,
};

Deno.test("CreativeDNASchema - accepts valid creative DNA", () => {
  const result = CreativeDNASchema.safeParse(validCreative);
  assertEquals(result.success, true);
});

Deno.test("CreativeDNASchema - accepts all valid action values", () => {
  const actions = ["KILL", "SCALE", "WATCH", "REFRESH", "HOLD"] as const;
  for (const action of actions) {
    const result = CreativeDNASchema.safeParse({ ...validCreative, action });
    assertEquals(result.success, true, `Action ${action} should be valid`);
  }
});

Deno.test("CreativeDNASchema - accepts all valid fatigue_status values", () => {
  const statuses = ["OK", "WARNING", "CRITICAL"] as const;
  for (const fatigue_status of statuses) {
    const result = CreativeDNASchema.safeParse({ ...validCreative, fatigue_status });
    assertEquals(result.success, true, `fatigue_status ${fatigue_status} should be valid`);
  }
});

Deno.test("CreativeDNASchema - rejects missing ad_id", () => {
  const { ad_id: _removed, ...withoutAdId } = validCreative;
  const result = CreativeDNASchema.safeParse(withoutAdId);
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - rejects empty ad_id", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, ad_id: "" });
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - rejects negative spend", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, total_spend_aed: -1 });
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - rejects invalid fatigue_status", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, fatigue_status: "SEVERE" });
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - rejects invalid action", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, action: "PAUSE" });
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - rejects non-integer priority", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, priority: 1.5 });
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - rejects priority < 1", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, priority: 0 });
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - rejects non-number ctr_pct", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, ctr_pct: "2.34%" });
  assertEquals(result.success, false);
});

Deno.test("CreativeDNASchema - validation error includes path for invalid action", () => {
  const result = CreativeDNASchema.safeParse({ ...validCreative, action: "INVALID" });
  assertEquals(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join("."));
    assertEquals(paths.includes("action"), true);
  }
});
