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
 * Truth/Query API
 * 
 * Merges data from multiple sources and returns answer with citations.
 * Uses ultimate truth alignment logic to find single source of truth.
 * 
 * Sources merged:
 * - contacts (HubSpot)
 * - deals (HubSpot)
 * - attribution_events (AnyTrack)
 * - ultimate_truth_events (aligned events)
 * - client_health_scores (calculated)
 * - events (all sources)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const supabase = getSupabaseClient();

  try {
    if (req.method === "GET") {
      // Get query from query params
      const { query, email, limit = 50 } = req.query;
      
      if (!query) {
        return res.status(400).json({
          error: "query parameter required",
          hint: "Use ?query=your_question or POST with {query: 'your_question'}"
        });
      }

      const result = await processTruthQuery(supabase, query as string, email as string, parseInt(limit as string));
      return res.status(200).json(result);
    }

    if (req.method === "POST") {
      const { query, email, limit = 50, sources } = req.body;

      if (!query) {
        return res.status(400).json({
          error: "query field required in body",
          hint: 'Send {query: "your question"}'
        });
      }

      const result = await processTruthQuery(supabase, query, email, limit, sources);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: "Method not allowed. Use GET or POST." });
  } catch (error: any) {
    console.error("[truth-api] Error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

async function processTruthQuery(
  supabase: any,
  query: string,
  email?: string,
  limit: number = 50,
  sources?: string[]
) {
  const citations: string[] = [];
  const mergedData: any = {};
  let confidence = 0;

  // Normalize query for matching
  const queryLower = query.toLowerCase();
  const isEmailQuery = email || queryLower.includes('email') || queryLower.includes('contact');
  const isDealQuery = queryLower.includes('deal') || queryLower.includes('pipeline') || queryLower.includes('close');
  const isAttributionQuery = queryLower.includes('attribution') || queryLower.includes('source') || queryLower.includes('campaign');
  const isHealthQuery = queryLower.includes('health') || queryLower.includes('churn') || queryLower.includes('risk');
  const isROIQuery = queryLower.includes('roi') || queryLower.includes('ltv') || queryLower.includes('cac') || queryLower.includes('revenue');

  // 1. Query contacts (HubSpot - PII truth)
  if (isEmailQuery || !sources || sources.includes('contacts')) {
    try {
      let contactsQuery = supabase.from('contacts').select('*');
      
      if (email) {
        contactsQuery = contactsQuery.eq('email', email);
      } else if (queryLower.includes('lead') || queryLower.includes('mql') || queryLower.includes('sql')) {
        // Filter by lifecycle stage
        if (queryLower.includes('lead')) contactsQuery = contactsQuery.eq('lifecycle_stage', 'lead');
        if (queryLower.includes('mql')) contactsQuery = contactsQuery.eq('lifecycle_stage', 'marketingqualifiedlead');
        if (queryLower.includes('sql')) contactsQuery = contactsQuery.eq('lifecycle_stage', 'salesqualifiedlead');
      }
      
      const { data: contacts, error } = await contactsQuery.limit(limit);
      
      if (!error && contacts && contacts.length > 0) {
        mergedData.contacts = contacts;
        citations.push('contacts');
        confidence += 0.2;
      }
    } catch (e) {
      console.warn('[truth-api] Contacts query error:', e);
    }
  }

  // 2. Query deals (HubSpot - conversion truth)
  if (isDealQuery || !sources || sources.includes('deals')) {
    try {
      let dealsQuery = supabase.from('deals').select('*');
      
      if (email) {
        // Get deals for contact email
        const { data: contact } = await supabase
          .from('contacts')
          .select('hubspot_contact_id')
          .eq('email', email)
          .single();
        
        if (contact?.hubspot_contact_id) {
          dealsQuery = dealsQuery.eq('hubspot_contact_id', contact.hubspot_contact_id);
        }
      }
      
      if (queryLower.includes('closed') || queryLower.includes('won')) {
        dealsQuery = dealsQuery.eq('status', 'closed_won');
      }
      
      const { data: deals, error } = await dealsQuery.limit(limit);
      
      if (!error && deals && deals.length > 0) {
        mergedData.deals = deals;
        citations.push('deals');
        confidence += 0.25;
      }
    } catch (e) {
      console.warn('[truth-api] Deals query error:', e);
    }
  }

  // 3. Query attribution_events (AnyTrack - attribution truth)
  if (isAttributionQuery || isROIQuery || !sources || sources.includes('attribution')) {
    try {
      let attributionQuery = supabase.from('attribution_events').select('*');
      
      if (email) {
        attributionQuery = attributionQuery.eq('email', email);
      }
      
      if (queryLower.includes('facebook') || queryLower.includes('meta')) {
        attributionQuery = attributionQuery.eq('source', 'facebook');
      }
      if (queryLower.includes('google')) {
        attributionQuery = attributionQuery.eq('source', 'google');
      }
      
      const { data: attribution, error } = await attributionQuery.limit(limit);
      
      if (!error && attribution && attribution.length > 0) {
        mergedData.attribution = attribution;
        citations.push('attribution_events');
        confidence += 0.2;
      }
    } catch (e) {
      console.warn('[truth-api] Attribution query error:', e);
    }
  }

  // 4. Query ultimate_truth_events (aligned events)
  if (!sources || sources.includes('ultimate_truth')) {
    try {
      let truthQuery = supabase.from('ultimate_truth_events').select('*');
      
      if (email) {
        truthQuery = truthQuery.eq('email', email);
      }
      
      // Filter by confidence if query mentions it
      if (queryLower.includes('high confidence') || queryLower.includes('reliable')) {
        truthQuery = truthQuery.gte('confidence_score', 80);
      }
      
      const { data: truthEvents, error } = await truthQuery.order('confidence_score', { ascending: false }).limit(limit);
      
      if (!error && truthEvents && truthEvents.length > 0) {
        mergedData.ultimate_truth = truthEvents;
        citations.push('ultimate_truth_events');
        confidence += 0.25;
      }
    } catch (e) {
      console.warn('[truth-api] Ultimate truth query error:', e);
    }
  }

  // 5. Query client_health_scores (health truth)
  if (isHealthQuery || !sources || sources.includes('health')) {
    try {
      let healthQuery = supabase.from('client_health_scores').select('*');
      
      if (email) {
        healthQuery = healthQuery.eq('email', email);
      }
      
      if (queryLower.includes('red') || queryLower.includes('at risk')) {
        healthQuery = healthQuery.eq('health_zone', 'RED');
      }
      if (queryLower.includes('yellow')) {
        healthQuery = healthQuery.eq('health_zone', 'YELLOW');
      }
      if (queryLower.includes('green')) {
        healthQuery = healthQuery.eq('health_zone', 'GREEN');
      }
      
      const { data: health, error } = await healthQuery.limit(limit);
      
      if (!error && health && health.length > 0) {
        mergedData.health_scores = health;
        citations.push('client_health_scores');
        confidence += 0.15;
      }
    } catch (e) {
      console.warn('[truth-api] Health scores query error:', e);
    }
  }

  // 6. Query lead_lifecycle_view (lifecycle truth)
  if (isEmailQuery || queryLower.includes('lifecycle') || !sources || sources.includes('lifecycle')) {
    try {
      let lifecycleQuery = supabase.from('lead_lifecycle_view').select('*');
      
      if (email) {
        lifecycleQuery = lifecycleQuery.eq('email', email);
      }
      
      const { data: lifecycle, error } = await lifecycleQuery.limit(limit);
      
      if (!error && lifecycle && lifecycle.length > 0) {
        mergedData.lifecycle = lifecycle;
        citations.push('lead_lifecycle_view');
        confidence += 0.1;
      }
    } catch (e) {
      console.warn('[truth-api] Lifecycle view query error:', e);
    }
  }

  // Calculate final confidence (capped at 1.0)
  confidence = Math.min(1.0, confidence);

  // Count total records merged
  const totalRecords = Object.values(mergedData).reduce((sum: number, arr: any) => {
    return sum + (Array.isArray(arr) ? arr.length : 0);
  }, 0);

  // Build summary
  return {
    ok: true,
    query,
    sources_merged: citations.length,
    total_records: totalRecords,
    citations,
    confidence: Math.round(confidence * 100) / 100,
    data: mergedData,
    timestamp: new Date().toISOString(),
  };
}

