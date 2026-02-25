import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ScoutSignalSchema } from "./index.ts";

// ============================================================================
// ScoutSignalSchema — unit tests
// ============================================================================

const validSignal = {
  signal_type: "fatigue" as const,
  ad_id: "act_123_ad_789",
  ad_name: "DIFC Executive Ad",
  campaign_name: "Q1 Dubai Campaign",
  severity: "warning" as const,
  evidence: {
    ctr_day1: 2.1,
    ctr_day2: 1.8,
    ctr_day3: 1.4,
    drop_pct: 33.33,
  },
  agent_name: "scout" as const,
};

Deno.test("ScoutSignalSchema - accepts valid fatigue signal", () => {
  const result = ScoutSignalSchema.safeParse(validSignal);
  assertEquals(result.success, true);
});

Deno.test("ScoutSignalSchema - accepts all valid signal_type values", () => {
  const types = ["fatigue", "ghost_spike", "new_winner", "spend_anomaly"] as const;
  for (const signal_type of types) {
    const result = ScoutSignalSchema.safeParse({ ...validSignal, signal_type });
    assertEquals(result.success, true, `signal_type ${signal_type} should be valid`);
  }
});

Deno.test("ScoutSignalSchema - accepts all valid severity values", () => {
  const severities = ["info", "warning", "critical", "opportunity"] as const;
  for (const severity of severities) {
    const result = ScoutSignalSchema.safeParse({ ...validSignal, severity });
    assertEquals(result.success, true, `severity ${severity} should be valid`);
  }
});

Deno.test("ScoutSignalSchema - accepts null ad_name and campaign_name", () => {
  const result = ScoutSignalSchema.safeParse({
    ...validSignal,
    ad_name: null,
    campaign_name: null,
  });
  assertEquals(result.success, true);
});

Deno.test("ScoutSignalSchema - rejects missing ad_id", () => {
  const { ad_id: _removed, ...withoutAdId } = validSignal;
  const result = ScoutSignalSchema.safeParse(withoutAdId);
  assertEquals(result.success, false);
});

Deno.test("ScoutSignalSchema - rejects empty ad_id string", () => {
  const result = ScoutSignalSchema.safeParse({ ...validSignal, ad_id: "" });
  assertEquals(result.success, false);
});

Deno.test("ScoutSignalSchema - rejects invalid signal_type", () => {
  const result = ScoutSignalSchema.safeParse({ ...validSignal, signal_type: "unknown_signal" });
  assertEquals(result.success, false);
});

Deno.test("ScoutSignalSchema - rejects invalid severity", () => {
  const result = ScoutSignalSchema.safeParse({ ...validSignal, severity: "extreme" });
  assertEquals(result.success, false);
});

Deno.test("ScoutSignalSchema - rejects wrong agent_name", () => {
  const result = ScoutSignalSchema.safeParse({ ...validSignal, agent_name: "analyst" });
  assertEquals(result.success, false);
});

Deno.test("ScoutSignalSchema - rejects string values in evidence record", () => {
  const result = ScoutSignalSchema.safeParse({
    ...validSignal,
    evidence: { ctr_day1: "high" },
  });
  assertEquals(result.success, false);
});

Deno.test("ScoutSignalSchema - accepts empty evidence object", () => {
  const result = ScoutSignalSchema.safeParse({ ...validSignal, evidence: {} });
  assertEquals(result.success, true);
});

Deno.test("ScoutSignalSchema - validation error includes path info", () => {
  const result = ScoutSignalSchema.safeParse({ ...validSignal, signal_type: "bad" });
  assertEquals(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join("."));
    assertEquals(paths.includes("signal_type"), true);
  }
});
