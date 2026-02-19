import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Lazy-load Supabase client to avoid top-level throws
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  }
  
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Generate device fingerprint from request
function generateDeviceFingerprint(req: VercelRequest): string {
  const ua = req.headers["user-agent"] || "";
  const accept = req.headers["accept"] || "";
  const acceptLang = req.headers["accept-language"] || "";
  const fingerprint = `${ua}|${accept}|${acceptLang}`;
  return Buffer.from(fingerprint).toString("base64").substring(0, 32);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const _authKey = process.env.PTD_INTERNAL_ACCESS_KEY; if (_authKey && (req.headers["x-ptd-key"] as string) !== _authKey && (req.headers["authorization"] as string) !== _authKey) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Get Supabase client inside handler (not at module level)
  const supabase = getSupabaseClient();

  try {
    switch (req.method) {
      case "POST": {
        // Create or get existing session
        const { session_id, device_fingerprint, browser_info, expires_in } = req.body;

        const ipAddress = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "";
        const userAgent = req.headers["user-agent"] || "";
        const deviceFp = device_fingerprint || generateDeviceFingerprint(req);

        let sessionId = session_id;

        // If session_id provided, check if exists
        if (sessionId) {
          const { data: existing } = await supabase
            .from("server_sessions")
            .select("*")
            .eq("session_id", sessionId)
            .single();

          if (existing) {
            // Update last_accessed_at
            const expiresAt = expires_in
              ? new Date(Date.now() + expires_in * 1000).toISOString()
              : existing.expires_at;

            const { data: updated, error } = await supabase
              .from("server_sessions")
              .update({
                last_accessed_at: new Date().toISOString(),
                expires_at: expiresAt,
                browser_info: browser_info || existing.browser_info,
              })
              .eq("session_id", sessionId)
              .select()
              .single();

            if (error) throw error;

            return res.status(200).json({
              ok: true,
              session: updated,
              existing: true,
            });
          }
        }

        // Create new session
        if (!sessionId) {
          sessionId = randomUUID();
        }

        const expiresAt = expires_in
          ? new Date(Date.now() + expires_in * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default 30 days

        const { data: session, error } = await supabase
          .from("server_sessions")
          .insert({
            session_id: sessionId,
            device_fingerprint: deviceFp,
            browser_info: browser_info || {
              user_agent: userAgent,
              accept: req.headers["accept"],
              accept_language: req.headers["accept-language"],
            },
            ip_address: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
            user_agent: userAgent,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({
          ok: true,
          session: session,
          existing: false,
        });
      }

      case "GET": {
        // Get session info
        const { session_id } = req.query;
        const sessionId = typeof session_id === "string" ? session_id : null;

        if (!sessionId) {
          return res.status(400).json({ error: "session_id query parameter required" });
        }

        const { data: session, error } = await supabase
          .from("server_sessions")
          .select("*")
          .eq("session_id", sessionId)
          .single();

        if (error || !session) {
          return res.status(404).json({
            ok: false,
            error: "Session not found",
          });
        }

        // Check if expired
        if (session.expires_at && new Date(session.expires_at) < new Date()) {
          return res.status(410).json({
            ok: false,
            error: "Session expired",
            session: session,
          });
        }

        return res.status(200).json({
          ok: true,
          session: session,
        });
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error: any) {
    console.error("[session-api] Error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

