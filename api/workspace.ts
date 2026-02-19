import { requireAuth } from './_middleware/auth';
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Lazy-load Supabase client
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

/**
 * Workspace API
 * 
 * Simple access control and workspace management.
 * For in-house use: single workspace, open access with logging.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const supabase = getSupabaseClient();

  try {
    switch (req.method) {
      case "GET": {
        // Get workspace info (single workspace for now)
        const workspaceId = req.query.workspace_id as string || 'default';
        
        // Get workspace from global_memory
        const { data: workspace, error } = await supabase
          .from('global_memory')
          .select('*')
          .eq('memory_key', `workspace:${workspaceId}`)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        // If no workspace exists, return default
        const workspaceData = workspace?.memory_value || {
          workspace_id: workspaceId,
          name: 'PTD Fitness Workspace',
          access_level: 'open', // Open for company use
          created_at: new Date().toISOString(),
          users: [],
          devices: [],
        };

        return res.status(200).json({
          ok: true,
          workspace: workspaceData,
        });
      }

      case "POST": {
        // Create or update workspace
        const { workspace_id = 'default', name, access_level = 'open' } = req.body;

        // Store workspace in global_memory
        const { data, error } = await supabase
          .from('global_memory')
          .upsert({
            memory_key: `workspace:${workspace_id}`,
            memory_value: {
              workspace_id,
              name: name || 'PTD Fitness Workspace',
              access_level,
              updated_at: new Date().toISOString(),
            },
            memory_type: 'config',
          }, { onConflict: 'memory_key' })
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({
          ok: true,
          workspace: data.memory_value,
        });
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error: any) {
    console.error("[workspace-api] Error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

