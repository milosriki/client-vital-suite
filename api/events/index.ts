import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: 'Missing server configuration: SUPABASE_ANON_KEY',
    });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-capi`, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Events API error:', error);
    return res.status(500).json({ error: 'Events API failed' });
  }
}
