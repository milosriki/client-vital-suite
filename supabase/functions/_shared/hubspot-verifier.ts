import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

export async function verifyHubSpotSignature(
  req: Request,
  bodyText: string,
  secret: string
): Promise<boolean> {
  const signature = req.headers.get("x-hubspot-signature") || "";
  if (!signature) return false;

  const sourceString = secret + bodyText;
  const encoder = new TextEncoder();
  const data = encoder.encode(sourceString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const calculatedSignature = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return calculatedSignature === signature;
}
