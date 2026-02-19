import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Simple auth check for Vercel API routes.
 * Verifies x-ptd-key header matches PTD_INTERNAL_ACCESS_KEY env var.
 * If no PTD_INTERNAL_ACCESS_KEY is set, allows all requests (dev mode).
 */
export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const key = process.env.PTD_INTERNAL_ACCESS_KEY;
  if (!key) return true; // No key configured = dev mode

  const provided =
    (req.headers["x-ptd-key"] as string) ||
    (req.headers["authorization"] as string);

  if (!provided || provided !== key) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
