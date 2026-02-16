import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { verifyAuth } from "./auth-middleware.ts";
import { RateLimitError, UnauthorizedError } from "./app-errors.ts";

// ============================================================================
// AUTH MIDDLEWARE TESTS
// Ensures typed errors are thrown correctly for authentication failures
// ============================================================================

Deno.test("verifyAuth - allows OPTIONS requests (CORS preflight)", () => {
  const req = new Request("https://example.com", { method: "OPTIONS" });
  // Should not throw
  verifyAuth(req);
});

Deno.test("verifyAuth - throws UnauthorizedError when no token provided", () => {
  const req = new Request("https://example.com", { method: "POST" });

  const error = assertThrows(
    () => verifyAuth(req),
    UnauthorizedError,
    "Missing authentication credentials",
  );

  assertEquals(error instanceof UnauthorizedError, true);
  assertEquals(error.code, "UNAUTHORIZED");
  assertEquals(error.statusCode, 401);
});

Deno.test("verifyAuth - throws UnauthorizedError for invalid token format", () => {
  const req = new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer invalid-token" },
  });

  const error = assertThrows(
    () => verifyAuth(req),
    UnauthorizedError,
    "Invalid authentication token",
  );

  assertEquals(error instanceof UnauthorizedError, true);
  assertEquals(error.code, "UNAUTHORIZED");
  assertEquals(error.statusCode, 401);
});

Deno.test("verifyAuth - accepts valid JWT format (3 parts)", () => {
  const validJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const req = new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: `Bearer ${validJWT}` },
  });

  // Should not throw
  verifyAuth(req);
});

Deno.test("verifyAuth - accepts X-Auth-Token header", () => {
  const validJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const req = new Request("https://example.com", {
    method: "POST",
    headers: { "X-Auth-Token": validJWT },
  });

  // Should not throw
  verifyAuth(req);
});

Deno.test("verifyAuth - accepts lowercase x-auth-token header", () => {
  const validJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const req = new Request("https://example.com", {
    method: "POST",
    headers: { "x-auth-token": validJWT },
  });

  // Should not throw
  verifyAuth(req);
});

Deno.test("verifyAuth - rate limiting throws RateLimitError", () => {
  const validJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

  // Make 51 requests from the same IP to trigger rate limit
  for (let i = 0; i < 51; i++) {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validJWT}`,
        "x-forwarded-for": "192.168.1.100",
      },
    });

    if (i < 50) {
      // First 50 should succeed
      verifyAuth(req);
    } else {
      // 51st should throw RateLimitError
      const error = assertThrows(
        () => verifyAuth(req),
        RateLimitError,
      );

      assertEquals(error instanceof RateLimitError, true);
      assertEquals(error.code, "RATE_LIMITED");
      assertEquals(error.statusCode, 429);
      assertEquals(error.retryAfterSeconds, 60);
    }
  }
});

Deno.test("verifyAuth - rate limiting is per-IP", () => {
  const validJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

  // First IP makes 50 requests
  for (let i = 0; i < 50; i++) {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validJWT}`,
        "x-forwarded-for": "192.168.1.101",
      },
    });
    verifyAuth(req);
  }

  // Second IP should still be allowed (different IP)
  const req2 = new Request("https://example.com", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${validJWT}`,
      "x-forwarded-for": "192.168.1.102",
    },
  });

  // Should not throw
  verifyAuth(req2);
});

Deno.test("verifyAuth - RateLimitError has correct structure", () => {
  const validJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

  // Trigger rate limit
  for (let i = 0; i < 51; i++) {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validJWT}`,
        "x-forwarded-for": "192.168.1.103",
      },
    });

    if (i === 50) {
      const error = assertThrows(
        () => verifyAuth(req),
        RateLimitError,
      );

      // Verify error structure
      assertEquals(typeof error.code, "string");
      assertEquals(typeof error.statusCode, "number");
      assertEquals(typeof error.message, "string");
      assertEquals(typeof error.retryAfterSeconds, "number");
      assertEquals(typeof error.timestamp, "string");
    } else {
      verifyAuth(req);
    }
  }
});

Deno.test("verifyAuth - UnauthorizedError has correct structure", () => {
  const req = new Request("https://example.com", { method: "POST" });

  const error = assertThrows(
    () => verifyAuth(req),
    UnauthorizedError,
  );

  // Verify error structure
  assertEquals(typeof error.code, "string");
  assertEquals(typeof error.statusCode, "number");
  assertEquals(typeof error.message, "string");
  assertEquals(typeof error.timestamp, "string");
  assertEquals(error.code, "UNAUTHORIZED");
  assertEquals(error.statusCode, 401);
});
