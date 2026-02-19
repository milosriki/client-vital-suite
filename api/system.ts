import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * System API Route
 * 
 * Unified endpoint for system operations
 * 
 * Actions:
 * - data_quality: Check data quality
 * - integration_health: Check integration health
 * - pipeline_monitor: Monitor pipelines
 * - verify_keys: Verify API keys
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const _authKey = process.env.PTD_INTERNAL_ACCESS_KEY; if (_authKey && (req.headers["x-ptd-key"] as string) !== _authKey && (req.headers["authorization"] as string) !== _authKey) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { action, data } = req.body ?? {};
    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Route to appropriate Edge Function
    const functionMap: Record<string, string> = {
      data_quality: 'data-quality',
      integration_health: 'integration-health',
      pipeline_monitor: 'pipeline-monitor',
      verify_keys: 'verify-all-keys',
    };

    const edgeFunction = functionMap[action];
    if (!edgeFunction) {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${edgeFunction}`;
    console.log(`[api/system] Calling ${edgeFunction} with action: ${action}`);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(data || {}),
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: result.error || 'System operation failed', details: result });
    }

    return res.status(200).json({ ok: true, action, result });
  } catch (error: any) {
    console.error('[api/system] Error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

