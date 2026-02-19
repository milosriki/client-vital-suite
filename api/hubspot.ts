import { requireAuth } from './_middleware/auth';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Lazy-load Supabase client
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Unified HubSpot API Route
 * 
 * Actions supported:
 * - create_engagement: Create notes, emails, tasks, meetings, calls
 * - search_contacts: Search HubSpot contacts
 * - create_contact: Create new contact
 * - update_contact: Update existing contact
 * - reassign_owner: Change contact/deal owner
 * - sync_data: Sync HubSpot data to Supabase
 * 
 * Usage:
 *   POST /api/hubspot
 *   Body: { action: string, data: any }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { action, data } = req.body ?? {};

    if (!action) {
      return res.status(400).json({
        error: 'Missing action',
        hint: 'Send { action: "create_engagement", data: {...} }',
      });
    }

    // Get Supabase client
    const supabase = getSupabaseClient();

    // Route to appropriate Edge Function based on action
    let edgeFunction = 'hubspot-command-center';
    
    if (action === 'reassign_owner') {
      edgeFunction = 'reassign-owner';
    } else if (action === 'sync_data') {
      edgeFunction = 'sync-hubspot-to-supabase';
    } else if (action === 'fetch_live') {
      edgeFunction = 'fetch-hubspot-live';
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        error: 'Server configuration error',
        hint: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      });
    }

    // Call Supabase Edge Function
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${edgeFunction}`;
    
    console.log(`[api/hubspot] Calling ${edgeFunction} with action: ${action}`);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action,
        ...data,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[api/hubspot] Edge function error:`, result);
      return res.status(response.status).json({
        error: result.error || 'HubSpot operation failed',
        details: result,
      });
    }

    return res.status(200).json({
      ok: true,
      action,
      result,
    });

  } catch (error: any) {
    console.error('[api/hubspot] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

