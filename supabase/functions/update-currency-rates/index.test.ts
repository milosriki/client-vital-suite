import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invertRates } from "./index.ts";

// ============================================================================
// invertRates — pure unit tests (no network, no DB)
// ============================================================================

Deno.test("invertRates - inverts USD correctly (0.272 → ~3.676471 AED)", () => {
  const result = invertRates({ USD: 0.272 });
  // 1 / 0.272 = 3.676470588... → rounded to 6dp = 3.676471
  assertEquals(result["usd"], 3.676471);
});

Deno.test("invertRates - inverts EUR correctly", () => {
  const result = invertRates({ EUR: 0.25 });
  assertEquals(result["eur"], 4.0);
});

Deno.test("invertRates - inverts GBP correctly", () => {
  const result = invertRates({ GBP: 0.214986 });
  // 1 / 0.214986 ≈ 4.651930...
  const expected = parseFloat((1 / 0.214986).toFixed(6));
  assertEquals(result["gbp"], expected);
});

Deno.test("invertRates - AED is always 1 regardless of input", () => {
  const result = invertRates({ AED: 1, USD: 0.272 });
  assertEquals(result["aed"], 1);
});

Deno.test("invertRates - AED=1 injected even when not in raw input", () => {
  const result = invertRates({ USD: 0.272 });
  assertEquals(result["aed"], 1);
});

Deno.test("invertRates - zero rate is skipped", () => {
  const result = invertRates({ USD: 0, EUR: 0.25 });
  assertEquals(result["usd"], undefined);
  assertEquals(result["eur"], 4.0);
});

Deno.test("invertRates - negative rate is skipped", () => {
  const result = invertRates({ USD: -0.272 });
  assertEquals(result["usd"], undefined);
});

Deno.test("invertRates - non-number rate is skipped", () => {
  const result = invertRates({ USD: "not-a-number" as unknown as number });
  assertEquals(result["usd"], undefined);
});

Deno.test("invertRates - currency keys are lowercased", () => {
  const result = invertRates({ USD: 0.272, GBP: 0.215, EUR: 0.25 });
  assertEquals(typeof result["usd"], "number");
  assertEquals(typeof result["gbp"], "number");
  assertEquals(typeof result["eur"], "number");
  // Uppercase keys should not appear
  assertEquals(result["USD" as string], undefined);
});

Deno.test("invertRates - rates rounded to 6 decimal places", () => {
  const result = invertRates({ USD: 0.272 });
  const str = String(result["usd"]);
  // At most 6 decimal digits
  const decimalPart = str.includes(".") ? str.split(".")[1] : "";
  assertEquals(decimalPart.length <= 6, true);
});

Deno.test("invertRates - empty input returns only AED=1", () => {
  const result = invertRates({});
  assertEquals(Object.keys(result), ["aed"]);
  assertEquals(result["aed"], 1);
});

Deno.test("invertRates - handles many currencies without error", () => {
  const raw: Record<string, number> = {};
  const currencies = ["USD", "EUR", "GBP", "SAR", "JPY", "CAD", "AUD", "CHF", "INR"];
  const values = [0.272, 0.251, 0.215, 1.021, 40.89, 0.374, 0.426, 0.241, 22.73];
  currencies.forEach((c, i) => { raw[c] = values[i]; });

  const result = invertRates(raw);
  currencies.forEach((c) => {
    assertEquals(typeof result[c.toLowerCase()], "number");
    assertEquals(result[c.toLowerCase()] > 0, true);
  });
  assertEquals(result["aed"], 1);
});

// ============================================================================
// handler — integration tests with mocked fetch + Supabase
// ============================================================================

// Helper: mock globalThis.fetch for a single test, then restore
function withMockedFetch(
  responses: Array<{ url: string; body: unknown; status?: number }>,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const original = globalThis.fetch;
    let callIndex = 0;

    globalThis.fetch = async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const match = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;

      if (match.url && !url.includes(match.url)) {
        // Supabase REST calls: return empty success
        return new Response(JSON.stringify({ data: null, error: null }), { status: 200 });
      }

      return new Response(JSON.stringify(match.body), {
        status: match.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      await fn();
    } finally {
      globalThis.fetch = original;
    }
  };
}

Deno.test({
  name: "handler - OPTIONS preflight returns 200 with CORS headers",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { handler } = await import("./index.ts");
    const req = new Request("https://example.com", { method: "OPTIONS" });
    const res = await handler(req);
    assertEquals(res.status, 200);
    const origin = res.headers.get("Access-Control-Allow-Origin");
    assertEquals(origin, "*");
  },
});

Deno.test({
  name: "handler - success response has correct shape",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: withMockedFetch(
    [
      {
        url: "open.er-api.com",
        body: {
          result: "success",
          rates: { USD: 0.272, EUR: 0.251, GBP: 0.215, SAR: 1.021, AED: 1 },
        },
      },
      // Supabase upsert call — return no error
      { url: "", body: { data: [{}], error: null } },
    ],
    async () => {
      Deno.env.set("SUPABASE_URL", "https://fake.supabase.co");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role-key");

      const { handler } = await import("./index.ts");
      const req = new Request("https://example.com", { method: "POST" });
      const res = await handler(req);

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.success, true);
      assertEquals(typeof body.currencies_updated, "number");
      assertEquals(body.currencies_updated > 0, true);
      assertEquals(typeof body.key_rates, "object");
      assertEquals(typeof body.key_rates.usd, "number");
      assertEquals(typeof body.key_rates.eur, "number");
      assertEquals(typeof body.key_rates.gbp, "number");
      assertStringIncludes(body.fetched_at, "T"); // ISO timestamp
    },
  ),
});

Deno.test({
  name: "handler - exchange rate API error returns 500 with error message",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: withMockedFetch(
    [{ url: "open.er-api.com", body: "Service Unavailable", status: 503 }],
    async () => {
      Deno.env.set("SUPABASE_URL", "https://fake.supabase.co");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role-key");

      const { handler } = await import("./index.ts");
      const req = new Request("https://example.com", { method: "POST" });
      const res = await handler(req);

      assertEquals(res.status, 500);
      const body = await res.json();
      assertEquals(body.success, false);
      assertStringIncludes(body.error, "503");
    },
  ),
});

Deno.test({
  name: "handler - inverted USD rate is in success response key_rates",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: withMockedFetch(
    [
      {
        url: "open.er-api.com",
        body: { result: "success", rates: { USD: 0.272, EUR: 0.251, GBP: 0.215, SAR: 1.021 } },
      },
      { url: "", body: { data: [{}], error: null } },
    ],
    async () => {
      Deno.env.set("SUPABASE_URL", "https://fake.supabase.co");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role-key");

      const { handler } = await import("./index.ts");
      const req = new Request("https://example.com", { method: "POST" });
      const res = await handler(req);
      const body = await res.json();

      // USD should be inverted (not raw 0.272)
      assertEquals(body.key_rates.usd > 1, true); // AED > USD, so inverted rate > 1
      assertEquals(body.key_rates.usd, 3.676471);
    },
  ),
});
