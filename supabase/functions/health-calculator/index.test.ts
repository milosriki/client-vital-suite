import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { HealthScoreUpsertSchema, analyzeMomentum, detectPattern, calculateHealthScoreV3 } from "./index.ts";
import type { ClientData } from "./index.ts";

// ============================================================================
// HealthScoreUpsertSchema — unit tests
// ============================================================================

const validUpsert = {
  email: "john.doe@gmail.com",
  health_score: 72,
  health_zone: "GREEN" as const,
  churn_risk_score: 34,
  health_trend: "STABLE" as const,
  calculated_at: new Date().toISOString(),
  calculation_version: "v5.0-PackageDriven",
  sessions_last_7d: 2,
  sessions_last_30d: 8,
  engagement_score: 75,
  momentum_score: 68,
  package_health_score: 80,
  momentum_indicator: "STABLE" as const,
  intervention_priority: "NONE" as const,
  outstanding_sessions: 6,
  sessions_purchased: 10,
};

Deno.test("HealthScoreUpsertSchema - accepts valid upsert payload", () => {
  const result = HealthScoreUpsertSchema.safeParse(validUpsert);
  assertEquals(result.success, true);
});

Deno.test("HealthScoreUpsertSchema - accepts all valid health_zone values", () => {
  const zones = ["RED", "YELLOW", "GREEN", "PURPLE"] as const;
  for (const health_zone of zones) {
    const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, health_zone });
    assertEquals(result.success, true, `health_zone ${health_zone} should be valid`);
  }
});

Deno.test("HealthScoreUpsertSchema - accepts all valid health_trend values", () => {
  const trends = ["DECLINING", "STABLE", "IMPROVING"] as const;
  for (const health_trend of trends) {
    const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, health_trend });
    assertEquals(result.success, true, `health_trend ${health_trend} should be valid`);
  }
});

Deno.test("HealthScoreUpsertSchema - accepts all valid momentum_indicator values", () => {
  const indicators = ["STABLE", "ACCELERATING", "DECLINING"] as const;
  for (const momentum_indicator of indicators) {
    const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, momentum_indicator });
    assertEquals(result.success, true, `momentum_indicator ${momentum_indicator} should be valid`);
  }
});

Deno.test("HealthScoreUpsertSchema - accepts all valid intervention_priority values", () => {
  const priorities = ["CRITICAL", "HIGH", "NONE"] as const;
  for (const intervention_priority of priorities) {
    const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, intervention_priority });
    assertEquals(result.success, true, `intervention_priority ${intervention_priority} should be valid`);
  }
});

Deno.test("HealthScoreUpsertSchema - rejects invalid email", () => {
  const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, email: "not-an-email" });
  assertEquals(result.success, false);
});

Deno.test("HealthScoreUpsertSchema - rejects health_score > 100", () => {
  const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, health_score: 101 });
  assertEquals(result.success, false);
});

Deno.test("HealthScoreUpsertSchema - rejects health_score < 0", () => {
  const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, health_score: -1 });
  assertEquals(result.success, false);
});

Deno.test("HealthScoreUpsertSchema - rejects float health_score (must be int)", () => {
  const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, health_score: 72.5 });
  assertEquals(result.success, false);
});

Deno.test("HealthScoreUpsertSchema - rejects negative sessions_last_7d", () => {
  const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, sessions_last_7d: -1 });
  assertEquals(result.success, false);
});

Deno.test("HealthScoreUpsertSchema - rejects invalid health_zone", () => {
  const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, health_zone: "ORANGE" });
  assertEquals(result.success, false);
});

Deno.test("HealthScoreUpsertSchema - rejects invalid momentum_indicator", () => {
  const result = HealthScoreUpsertSchema.safeParse({ ...validUpsert, momentum_indicator: "RECOVERING" });
  assertEquals(result.success, false);
});

// ============================================================================
// analyzeMomentum — pure logic tests
// ============================================================================

function makeClient(overrides: Partial<ClientData> = {}): ClientData {
  return {
    id: "test-id",
    email: "test@test.com",
    of_sessions_conducted__last_7_days_: "2",
    of_conducted_sessions__last_30_days_: "8",
    of_sessions_conducted__last_90_days_: "24",
    ...overrides,
  };
}

Deno.test("analyzeMomentum - returns NO_DATA when all sessions are 0", () => {
  const client = makeClient({
    of_sessions_conducted__last_7_days_: "0",
    of_conducted_sessions__last_30_days_: "0",
    of_sessions_conducted__last_90_days_: "0",
  });
  const result = analyzeMomentum(client);
  assertEquals(result.status, "NO_DATA");
  assertEquals(result.velocity, 0);
});

Deno.test("analyzeMomentum - returns CLIFF_FALL when current week is 0 but baseline strong", () => {
  const client = makeClient({
    of_sessions_conducted__last_7_days_: "0",
    of_conducted_sessions__last_30_days_: "8",
    of_sessions_conducted__last_90_days_: "24",
  });
  const result = analyzeMomentum(client);
  assertEquals(result.status, "CLIFF_FALL");
});

Deno.test("analyzeMomentum - returns ACCELERATING when weekly sessions well above baseline", () => {
  const client = makeClient({
    of_sessions_conducted__last_7_days_: "5",
    of_conducted_sessions__last_30_days_: "16",
    of_sessions_conducted__last_90_days_: "12",
  });
  const result = analyzeMomentum(client);
  assertEquals(result.status, "ACCELERATING");
});

// ============================================================================
// calculateHealthScoreV3 — zone boundary tests
// ============================================================================

Deno.test("calculateHealthScoreV3 - inactive client scores RED zone", () => {
  const client = makeClient({
    last_paid_session_date: new Date(Date.now() - 30 * 86400000).toISOString(),
    of_sessions_conducted__last_7_days_: "0",
    of_conducted_sessions__last_30_days_: "0",
    of_sessions_conducted__last_90_days_: "0",
    outstanding_sessions: "2",
    sessions_purchased: "10",
    of_future_booked_sessions: "0",
  });
  const result = calculateHealthScoreV3(client, false);
  assertEquals(result.healthZone, "RED");
});

Deno.test("calculateHealthScoreV3 - active client with bookings scores above RED", () => {
  const client = makeClient({
    last_paid_session_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    of_sessions_conducted__last_7_days_: "3",
    of_conducted_sessions__last_30_days_: "12",
    of_sessions_conducted__last_90_days_: "36",
    outstanding_sessions: "8",
    sessions_purchased: "10",
    of_future_booked_sessions: "3",
    assigned_coach: "Coach Ahmed",
  });
  const result = calculateHealthScoreV3(client, true);
  assertEquals(["GREEN", "PURPLE", "YELLOW"].includes(result.healthZone), true);
});

Deno.test("calculateHealthScoreV3 - health score is between 0 and 100", () => {
  const client = makeClient();
  const result = calculateHealthScoreV3(client, true);
  assertEquals(result.healthScore >= 0, true);
  assertEquals(result.healthScore <= 100, true);
});

Deno.test("calculateHealthScoreV3 - returns all required fields", () => {
  const client = makeClient();
  const result = calculateHealthScoreV3(client, true);
  assertEquals(typeof result.contactId, "string");
  assertEquals(typeof result.email, "string");
  assertEquals(typeof result.healthScore, "number");
  assertEquals(typeof result.healthZone, "string");
  assertEquals(typeof result.churnPrediction.probability30d, "number");
  assertEquals(Array.isArray(result.churnPrediction.riskFactors), true);
});
