import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  calculateHealthScoreV3,
  analyzeMomentum,
  detectPattern,
  ClientData,
} from "./index.ts";

// Mock Data Helper
function mockClient(overrides: Partial<ClientData> = {}): ClientData {
  return {
    id: "123",
    email: "test@example.com",
    firstname: "Test",
    lastname: "User",
    // Defaults
    last_paid_session_date: new Date().toISOString(),
    of_sessions_conducted__last_7_days_: "2",
    of_conducted_sessions__last_30_days_: "8",
    of_sessions_conducted__last_90_days_: "24",
    outstanding_sessions: "10",
    sessions_purchased: "20",
    assigned_coach: "Coach Mark",
    next_session_is_booked: "true",
    of_future_booked_sessions: "3",
    ...overrides,
  };
}

Deno.test("Health Score V3 - Momentum Physics Engine", async (t) => {
  await t.step("should detect CLIFF_FALL (Sudden Stop)", () => {
    const client = mockClient({
      of_sessions_conducted__last_7_days_: "0",
      of_conducted_sessions__last_30_days_: "10", // ~2.3/week avg
    });
    const momentum = analyzeMomentum(client);
    assertEquals(momentum.status, "CLIFF_FALL");
  });

  await t.step("should detect ACCELERATING (Ramping Up)", () => {
    const client = mockClient({
      of_sessions_conducted__last_7_days_: "5", // 5/week
      of_conducted_sessions__last_30_days_: "8", // ~1.8/week
    }); // massive increase
    const momentum = analyzeMomentum(client);
    assertEquals(momentum.status, "ACCELERATING");
    assert(momentum.velocity > 20);
  });

  await t.step("should detect STABLE (Consistent)", () => {
    const client = mockClient({
      of_sessions_conducted__last_7_days_: "2",
      of_conducted_sessions__last_30_days_: "8", // ~1.8/week
    });
    const momentum = analyzeMomentum(client);
    // Velocity should be small
    assert(Math.abs(momentum.velocity) < 20);
  });
});

Deno.test("Health Score V3 - Behavioral Patterns", async (t) => {
  await t.step("should identify SUDDEN_STOP pattern", () => {
    const client = mockClient({
      of_sessions_conducted__last_7_days_: "0",
      of_conducted_sessions__last_30_days_: "12",
    });
    const mom = analyzeMomentum(client);
    const pattern = detectPattern(client, mom);
    assertEquals(pattern.pattern, "SUDDEN_STOP");
    assertEquals(pattern.interventionUrgency, "IMMEDIATE");
  });

  await t.step("should identify SILENT_FADE (Gradual Decline)", () => {
    const client = mockClient({
      of_sessions_conducted__last_90_days_: "20", // used to be active
      of_conducted_sessions__last_30_days_: "3", // dropped significantly (< 20/3 * 0.6 = 4)
      of_sessions_conducted__last_7_days_: "0", // now zero
    });
    const mom = analyzeMomentum(client);
    const pattern = detectPattern(client, mom);
    assertEquals(pattern.pattern, "SILENT_FADE");
  });
});

Deno.test("Health Score V3 - Composite Calculation", () => {
  const client = mockClient({
    of_sessions_conducted__last_7_days_: "0",
    of_conducted_sessions__last_30_days_: "0",
    outstanding_sessions: "0",
  });
  // Should be RED
  const res = calculateHealthScoreV3(client, true);
  assertEquals(res.healthZone, "RED");
  assert(res.churnPrediction.probability30d > 70);
  assertEquals(res.recommendedAction, "Urgent Intervention");
});
