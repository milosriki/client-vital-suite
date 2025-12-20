import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel API Route: Proxy to Supabase Edge Function ptd-agent-claude
 * 
 * This allows Vercel logs to show agent calls while using Supabase Edge Functions.
 * 
 * Environment Variables Required (set in Vercel Dashboard):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (server-only, never exposed to browser)
 * 
 * Usage from frontend:
 *   POST /api/agent
 *   Body: { message: string, thread_id?: string, messages?: Message[] }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    // Validate required environment variables (server-side only)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL) {
      console.error('[api/agent] SUPABASE_URL not configured');
      return res.status(500).json({ 
        error: 'Server configuration error: SUPABASE_URL not set',
        hint: 'Set SUPABASE_URL in Vercel environment variables'
      });
    }

    if (!SERVICE_KEY) {
      console.error('[api/agent] SUPABASE_SERVICE_ROLE_KEY not configured');
      return res.status(500).json({ 
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set',
        hint: 'Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables'
      });
    }

    // Validate request body
    const { message, thread_id, messages } = req.body ?? {};

    if (!message && (!messages || messages.length === 0)) {
      return res.status(400).json({ 
        error: 'Bad request: message or messages required',
        hint: 'Send { message: "your question" } or { messages: [...] }'
      });
    }

    // Log the request (visible in Vercel logs)
    console.log('[api/agent] Proxying request to ptd-agent-claude', {
      hasMessage: !!message,
      hasMessages: !!messages,
      threadId: thread_id || 'default',
      timestamp: new Date().toISOString()
    });

    // Proxy to Supabase Edge Function
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/ptd-agent-claude`;
    
    const startTime = Date.now();
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        message,
        thread_id,
        messages,
      }),
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text();

    // Log response (visible in Vercel logs)
    console.log('[api/agent] Response from Supabase', {
      status: response.status,
      duration_ms: duration,
      responseLength: responseText.length,
      timestamp: new Date().toISOString()
    });

    // Parse JSON response if possible
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If not JSON, return as text
      responseData = { response: responseText };
    }

    // Forward status and response
    res.status(response.status).json(responseData);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[api/agent] Proxy error:', errMsg);
    
    return res.status(500).json({
      error: 'Proxy error',
      message: errMsg,
      hint: 'Check Vercel logs for details'
    });
  }
}

