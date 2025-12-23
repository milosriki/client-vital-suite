import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Stripe API Route
 * 
 * Unified endpoint for Stripe operations
 * 
 * Actions:
 * - dashboard_data: Get dashboard data
 * - forensics: Fraud detection and analysis
 * - payouts_ai: AI-powered payout analysis
 * - enrich: Enrich data with Stripe
 * - history: Historical data
 * - payout_controls: Payout controls
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      dashboard_data: 'stripe-dashboard-data',
      forensics: 'stripe-forensics',
      payouts_ai: 'stripe-payouts-ai',
      enrich: 'enrich-with-stripe',
      history: 'stripe-history',
      payout_controls: 'stripe-payout-controls',
      treasury: 'stripe-treasury',
      issuing_tokens: 'stripe-issuing-tokens',
    };

    const edgeFunction = functionMap[action];
    if (!edgeFunction) {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${edgeFunction}`;
    console.log(`[api/stripe] Calling ${edgeFunction} with action: ${action}`);

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
      return res.status(response.status).json({ error: result.error || 'Stripe operation failed', details: result });
    }

    return res.status(200).json({ ok: true, action, result });
  } catch (error: any) {
    console.error('[api/stripe] Error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

