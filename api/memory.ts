import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const _authKey = process.env.PTD_INTERNAL_ACCESS_KEY; if (_authKey && (req.headers["x-ptd-key"] as string) !== _authKey && (req.headers["authorization"] as string) !== _authKey) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Get Supabase client inside handler (not at module level)
    const supabase = getSupabaseClient();

    const { session_id, global } = req.query;
    const sessionId = typeof session_id === "string" ? session_id : null;
    const isGlobal = global === "true" || global === "1";

    // Global memory doesn't require session_id
    if (!isGlobal && !sessionId && req.method !== "POST") {
        return res.status(400).json({ error: "session_id query parameter required (or use ?global=true)" });
    }

    try {
        switch (req.method) {
            case "GET": {
                // Get memory - global or session-scoped
                const { key } = req.query;
                const memoryKey = typeof key === "string" ? key : null;

                if (isGlobal) {
                    // Global memory from global_memory table
                    let query = supabase
                        .from("global_memory")
                        .select("*")
                        .is("expires_at", null)
                        .or("expires_at.gt." + new Date().toISOString());

                    if (memoryKey) {
                        query = query.eq("memory_key", memoryKey);
                    }

                    const { data, error } = await query.order("updated_at", { ascending: false });
                    if (error) throw error;

                    return res.status(200).json({
                        ok: true,
                        global: true,
                        memory: data || [],
                    });
                } else {
                    // Session-scoped memory
                    let query = supabase
                        .from("server_memory")
                        .select("*")
                        .eq("session_id", sessionId)
                        .is("expires_at", null)
                        .or("expires_at.gt." + new Date().toISOString());

                    if (memoryKey) {
                        query = query.eq("memory_key", memoryKey);
                    }

                    const { data, error } = await query.order("updated_at", { ascending: false });
                    if (error) throw error;

                    return res.status(200).json({
                        ok: true,
                        session_id: sessionId,
                        memory: data || [],
                    });
                }
            }

            case "POST": {
                // Store memory - global or session-scoped
                const { session_id: bodySessionId, key, value, type, expires_in, global: bodyGlobal } = req.body;

                const isGlobalMemory = bodyGlobal === true || bodyGlobal === "true" || isGlobal;
                const finalSessionId = bodySessionId || sessionId;

                if (!key || value === undefined) {
                    return res.status(400).json({
                        error: "key and value are required",
                    });
                }

                if (isGlobalMemory) {
                    // Store in global_memory table (accessible from all devices)
                    const expiresAt = expires_in
                        ? new Date(Date.now() + expires_in * 1000).toISOString()
                        : null;

                    const { data, error } = await supabase
                        .from("global_memory")
                        .upsert(
                            {
                                memory_key: key,
                                memory_value: value,
                                memory_type: type || "shared",
                                updated_at: new Date().toISOString(),
                                expires_at: expiresAt,
                                updated_by: req.headers["user-agent"] || "unknown",
                            },
                            { onConflict: "memory_key" }
                        )
                        .select()
                        .single();

                    if (error) throw error;

                    return res.status(200).json({
                        ok: true,
                        global: true,
                        memory: data,
                    });
                } else {
                    // Session-scoped memory
                    if (!finalSessionId) {
                        return res.status(400).json({
                            error: "session_id required for session-scoped memory (or set global: true)",
                        });
                    }

                    // Ensure session exists
                    const { data: session } = await supabase
                        .from("server_sessions")
                        .select("session_id")
                        .eq("session_id", finalSessionId)
                        .single();

                    if (!session) {
                        return res.status(404).json({
                            error: "Session not found. Create session first via /api/session",
                        });
                    }

                    const expiresAt = expires_in
                        ? new Date(Date.now() + expires_in * 1000).toISOString()
                        : null;

                    const { data, error } = await supabase
                        .from("server_memory")
                        .upsert(
                            {
                                session_id: finalSessionId,
                                memory_key: key,
                                memory_value: value,
                                memory_type: type || "context",
                                updated_at: new Date().toISOString(),
                                expires_at: expiresAt,
                            },
                            { onConflict: "session_id,memory_key" }
                        )
                        .select()
                        .single();

                    if (error) throw error;

                    return res.status(200).json({
                        ok: true,
                        memory: data,
                    });
                }
            }

            case "DELETE": {
                // Delete memory - global or session-scoped
                const { key } = req.query;
                const memoryKey = typeof key === "string" ? key : null;

                if (isGlobal) {
                    // Delete from global_memory
                    let query = supabase.from("global_memory").delete();

                    if (memoryKey) {
                        query = query.eq("memory_key", memoryKey);
                    } else {
                        return res.status(400).json({
                            error: "key parameter required for global memory deletion",
                        });
                    }

                    const { error } = await query;
                    if (error) throw error;

                    return res.status(200).json({
                        ok: true,
                        global: true,
                        deleted: `global key: ${memoryKey}`,
                    });
                } else {
                    // Delete session-scoped memory
                    let query = supabase.from("server_memory").delete().eq("session_id", sessionId);

                    if (memoryKey) {
                        query = query.eq("memory_key", memoryKey);
                    }

                    const { error } = await query;
                    if (error) throw error;

                    return res.status(200).json({
                        ok: true,
                        deleted: memoryKey ? `key: ${memoryKey}` : "all memory for session",
                    });
                }
            }

            default:
                return res.status(405).json({ error: "Method not allowed" });
        }
    } catch (error: any) {
        console.error("[memory-api] Error:", error);
        return res.status(500).json({
            ok: false,
            error: error.message || "Internal server error",
        });
    }
}

