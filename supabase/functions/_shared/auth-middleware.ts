import { corsHeaders } from "./error-handler.ts";
import { RateLimitError, UnauthorizedError } from "./app-errors.ts";

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 requests per minute per IP (per isolate)
};

const ipHits = new Map<string, { count: number; resetTime: number }>();

export function verifyAuth(req: Request) {
  // 1. Allow CORS Preflight
  if (req.method === "OPTIONS") return;

  // 2. CHECK RATE LIMIT (DDoS Protection)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const now = Date.now();

  if (!ipHits.has(ip) || ipHits.get(ip)!.resetTime < now) {
    ipHits.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
  } else {
    const data = ipHits.get(ip)!;
    data.count++;
    if (data.count > RATE_LIMIT.maxRequests) {
      console.warn(`🛑 Rate Limit Exceeded for IP: ${ip}`);
      throw new RateLimitError(60);
    }
  }

  // 3. CHECK AUTH
  const authHeader = req.headers.get("Authorization");
  const xAuthToken =
    req.headers.get("X-Auth-Token") || req.headers.get("x-auth-token");

  const token = authHeader?.replace("Bearer ", "") || xAuthToken;

  if (!token) {
    console.error(`❌ Blocking request: No Authentication found. IP: ${ip}`);
    throw new UnauthorizedError("Missing authentication credentials");
  }

  // Verify JWT (Basic check - for full security, use getUser or verifyJWT)
  // Let's at least check for a basic JWT structure to prevent obvious garbage
  const parts = token.split(".");
  if (parts.length !== 3) {
    console.error(`❌ Blocking request: Invalid Token format. IP: ${ip}`);
    throw new UnauthorizedError("Invalid authentication token");
  }
}
