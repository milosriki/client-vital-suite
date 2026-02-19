import { requireAuth } from './_middleware/auth';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Intelligence API Route
 * 
 * Unified endpoint for health, churn, anomalies, interventions, coach analysis
 * 
 * Actions:
 * - calculate_health: Calculate client health scores
 * - predict_churn: Predict churn risk
 * - detect_anomalies: Detect data anomalies
 * - recommend_interventions: Get intervention recommendations
 * - analyze_coach: Analyze coach performance
 * - generate_insights: Generate proactive insights
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
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
      calculate_health: 'health-calculator',
      predict_churn: 'churn-predictor',
      detect_anomalies: 'anomaly-detector',
      recommend_interventions: 'intervention-recommender',
      analyze_coach: 'coach-analyzer',
      generate_insights: 'proactive-insights-generator',
      business_intelligence: 'business-intelligence',
    };

    const edgeFunction = functionMap[action];
    if (!edgeFunction) {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${edgeFunction}`;
    console.log(`[api/intelligence] Calling ${edgeFunction} with action: ${action}`);

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
      return res.status(response.status).json({ error: result.error || 'Intelligence operation failed', details: result });
    }

    return res.status(200).json({ ok: true, action, result });
  } catch (error: any) {
    console.error('[api/intelligence] Error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

