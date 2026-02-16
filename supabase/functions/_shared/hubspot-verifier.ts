import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify HubSpot webhook signatures — supports v1, v2, and v3.
 * HubSpot sends all versions simultaneously; we try the newest first.
 *
 * v1: SHA-256(clientSecret + requestBody)                  → X-HubSpot-Signature
 * v2: SHA-256(clientSecret + method + url + requestBody)   → X-HubSpot-Signature-v2 (not yet used here)
 * v3: HMAC-SHA-256(clientSecret, method + url + body + timestamp) → X-HubSpot-Signature-v3
 *
 * Ref: https://developers.hubspot.com/docs/apps/legacy-apps/authentication/validating-requests
 */
export async function verifyHubSpotSignature(
  req: Request,
  bodyText: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();

  // --- Try v3 first (HMAC-SHA-256, most secure) ---
  const sigV3 = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  if (sigV3 && timestamp) {
    // Reject if timestamp is older than 5 minutes (replay protection)
    const ts = parseInt(timestamp, 10);
    if (!isNaN(ts) && Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      console.warn("⚠️ HubSpot v3 signature rejected: timestamp too old");
      return false;
    }
    const url = req.url;
    const method = req.method;
    const sourceString = `${method}${url}${bodyText}${timestamp}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(sourceString));
    // HubSpot v3 sends base64-encoded signature
    const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
    if (computed === sigV3) return true;
    console.warn("⚠️ HubSpot v3 signature mismatch (may be URL difference)");
    // Fall through to v1
  }

  // --- Try v1 (SHA-256, basic) ---
  const sigV1 = req.headers.get("x-hubspot-signature") || "";
  if (sigV1) {
    const sourceString = secret + bodyText;
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(sourceString));
    const calculated = toHex(hashBuffer);
    if (calculated === sigV1) return true;
    console.warn("⚠️ HubSpot v1 signature mismatch");
    return false;
  }

  // No recognized signature header found
  console.warn("⚠️ No HubSpot signature header found (x-hubspot-signature or x-hubspot-signature-v3)");
  return false;
}
