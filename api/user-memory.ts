import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * PERMANENT USER MEMORY API
 * 
 * Memory is tied to user_key (email, name, ID - whatever you choose)
 * - NEVER expires
 * - Accessible from ANY device
 * - All data stored server-side only
 */

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-User-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // User key from header or query/body
  const userKey = 
    req.headers["x-user-key"] as string ||
    (req.query.user_key as string) ||
    (req.body?.user_key as string);

  if (!userKey) {
    return res.status(400).json({ 
      ok: false, 
      error: "user_key required (header X-User-Key, query param, or body)" 
    });
  }

  const supabase = getSupabaseClient();

  try {
    switch (req.method) {
      // ========================================
      // GET - Retrieve memory
      // ========================================
      case "GET": {
        const { key, type } = req.query;
        
        let query = supabase
          .from("user_memory")
          .select("*")
          .eq("user_key", userKey);

        if (key) {
          query = query.eq("memory_key", key as string);
        }
        if (type) {
          query = query.eq("memory_type", type as string);
        }

        const { data, error } = await query.order("updated_at", { ascending: false });

        if (error) throw error;

        // If single key requested, return just the value
        if (key && data?.length === 1) {
          return res.status(200).json({
            ok: true,
            user_key: userKey,
            key: data[0].memory_key,
            value: data[0].memory_value,
            updated_at: data[0].updated_at,
          });
        }

        return res.status(200).json({
          ok: true,
          user_key: userKey,
          count: data?.length || 0,
          memory: data || [],
        });
      }

      // ========================================
      // POST/PUT - Store memory (upsert)
      // ========================================
      case "POST":
      case "PUT": {
        const { key, value, type } = req.body;

        if (!key || value === undefined) {
          return res.status(400).json({ 
            ok: false, 
            error: "key and value required in body" 
          });
        }

        // Get device info for tracking
        const deviceFingerprint = req.headers["x-device-fingerprint"] as string || null;
        const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || null;

        const { data, error } = await supabase
          .from("user_memory")
          .upsert({
            user_key: userKey,
            memory_key: key,
            memory_value: value,
            memory_type: type || "general",
            updated_at: new Date().toISOString(),
            last_device_fingerprint: deviceFingerprint,
            last_ip_address: ipAddress,
          }, { 
            onConflict: "user_key,memory_key",
          })
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({
          ok: true,
          user_key: userKey,
          key: data.memory_key,
          value: data.memory_value,
          updated_at: data.updated_at,
        });
      }

      // ========================================
      // DELETE - Remove memory
      // ========================================
      case "DELETE": {
        const { key } = req.query;

        let query = supabase
          .from("user_memory")
          .delete()
          .eq("user_key", userKey);

        if (key) {
          query = query.eq("memory_key", key as string);
        }

        const { error } = await query;

        if (error) throw error;

        return res.status(200).json({
          ok: true,
          deleted: key ? `key: ${key}` : "all memory for user",
        });
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error: any) {
    console.error("[user-memory] Error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}
