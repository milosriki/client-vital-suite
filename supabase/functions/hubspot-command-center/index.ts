import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface HubSpotLoginEvent {
  id: string;
  userId?: string;
  userEmail?: string;
  occurredAt?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  loginType?: string;
}

interface HubSpotSecurityEvent {
  id: string;
  userId?: string;
  userEmail?: string;
  eventType: string;
  occurredAt?: string;
  ipAddress?: string;
  details?: string;
}

// Calculate risk score for contact changes
function calculateRiskScore(eventType: string, propertyName: string | null, oldValue: string | null, newValue: string | null): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Deletion is highest risk
  if (eventType === 'deletion' || eventType === 'contact.deletion') {
    score += 5;
    reasons.push('Contact deleted');
  }

  // Critical property changes
  const criticalProps = ['lifecyclestage', 'hs_lead_status', 'hubspot_owner_id', 'email'];
  if (propertyName && criticalProps.includes(propertyName.toLowerCase())) {
    score += 2;
    reasons.push(`Critical property changed: ${propertyName}`);
  }

  // Status changes to negative values
  const negativeStatuses = ['junk', 'unqualified', 'bad', 'spam', 'unsubscribed', 'invalid'];
  if (newValue && negativeStatuses.some(s => newValue.toLowerCase().includes(s))) {
    score += 3;
    reasons.push(`Changed to negative status: ${newValue}`);
  }

  // Owner removal
  if (propertyName?.toLowerCase() === 'hubspot_owner_id' && !newValue && oldValue) {
    score += 2;
    reasons.push('Owner removed from contact');
  }

  // Lifecycle stage regression
  const stageOrder = ['subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'customer'];
  if (propertyName?.toLowerCase() === 'lifecyclestage' && oldValue && newValue) {
    const oldIdx = stageOrder.indexOf(oldValue.toLowerCase());
    const newIdx = stageOrder.indexOf(newValue.toLowerCase());
    if (oldIdx > newIdx && oldIdx !== -1 && newIdx !== -1) {
      score += 2;
      reasons.push(`Lifecycle regressed: ${oldValue} → ${newValue}`);
    }
  }

  return { score, reasons };
}

// Detect anomalies in user behavior
function detectAnomalies(summary: any): string[] {
  const anomalies: string[] = [];

  if (summary.exports > 5) {
    anomalies.push(`High export volume: ${summary.exports} exports`);
  }
  if (summary.contact_deletions > 10) {
    anomalies.push(`Mass deletions: ${summary.contact_deletions} contacts deleted`);
  }
  if (summary.status_changes > 20) {
    anomalies.push(`Excessive status changes: ${summary.status_changes} changes`);
  }
  if (summary.logins > 20) {
    anomalies.push(`Unusual login frequency: ${summary.logins} logins`);
  }
  if (summary.owner_changes > 15) {
    anomalies.push(`Mass owner reassignment: ${summary.owner_changes} changes`);
  }

  return anomalies;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!HUBSPOT_API_KEY) {
      throw new Error('HUBSPOT_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, from, to, userEmail, minRiskScore, mode } = await req.json();

    console.log(`[HubSpot Command Center] Action: ${action}, Mode: ${mode || 'live'}`);

    // Helper to call HubSpot API with pagination support
    async function hubspotFetchAll(path: string, method: 'GET' | 'POST' = 'GET', body?: any) {
      let allResults: any[] = [];
      let after: string | undefined = undefined;
      const isSearch = path.includes('/search');

      console.log(`Starting fetch for ${path}...`);

      do {
        const url = new URL(path, HUBSPOT_BASE_URL);
        if (!isSearch && after) {
          url.searchParams.set('after', after);
        }

        const options: RequestInit = {
          method,
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
        };

        if (method === 'POST' && body) {
          const pagedBody = { ...body };
          if (after) pagedBody.after = after;
          options.body = JSON.stringify(pagedBody);
        }

        const res = await fetch(url.toString(), options);

        if (!res.ok) {
          const text = await res.text();
          console.error(`HubSpot API error: ${res.status}`, text);
          throw new Error(`HubSpot API failed: ${res.status}`);
        }

        const data = await res.json();
        allResults = allResults.concat(data.results || []);

        after = data.paging?.next?.after;
        if (after) console.log(`Fetching next page...`);

      } while (after);

      return allResults;
    }

    // ACTION: Sync login activity from HubSpot
    if (action === 'sync-logins') {
      console.log('[Sync] Fetching login activity...');

      try {
        const results = await hubspotFetchAll('/account-info/v3/activity/login');

        let synced = 0;
        for (const event of results) {
          const { error } = await supabase.from('hubspot_login_activity').upsert({
            hubspot_id: event.id || `login_${event.occurredAt}_${event.userId}`,
            user_id: event.userId,
            user_email: event.userEmail,
            occurred_at: event.occurredAt,
            ip_address: event.ipAddress,
            user_agent: event.userAgent,
            location: event.location,
            login_type: event.loginType,
            raw: event,
          }, { onConflict: 'hubspot_id' });

          if (!error) synced++;
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'sync-logins',
          synced,
          total: results.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: unknown) {
        console.error('Login sync error:', e);
        return new Response(JSON.stringify({
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          note: 'Login activity API may require specific HubSpot permissions',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ACTION: Sync security activity from HubSpot
    if (action === 'sync-security') {
      console.log('[Sync] Fetching security activity...');

      try {
        const results = await hubspotFetchAll('/account-info/v3/activity/security');

        let synced = 0;
        for (const event of results) {
          const { error } = await supabase.from('hubspot_security_activity').upsert({
            hubspot_id: event.id || `sec_${event.occurredAt}_${event.userId}`,
            user_id: event.userId,
            user_email: event.userEmail,
            event_type: event.eventType || event.type || 'unknown',
            occurred_at: event.occurredAt,
            ip_address: event.ipAddress,
            details: event.details || event.description,
            raw: event,
          }, { onConflict: 'hubspot_id' });

          if (!error) synced++;
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'sync-security',
          synced,
          total: results.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: unknown) {
        console.error('Security sync error:', e);
        return new Response(JSON.stringify({
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          note: 'Security activity API may require specific HubSpot permissions',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ACTION: Sync recent contact changes (using timeline/property history)
    if (action === 'sync-contacts') {
      console.log('[Sync] Fetching recent contact changes...');

      try {
        const results = await hubspotFetchAll('/crm/v3/objects/contacts/search', 'POST', {
          filterGroups: [{
            filters: [{
              propertyName: 'lastmodifieddate',
              operator: 'GTE',
              value: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            }]
          }],
          sorts: [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
          limit: 100,
          properties: ['email', 'firstname', 'lastname', 'lifecyclestage', 'hs_lead_status', 'hubspot_owner_id'],
        });

        let synced = 0;
        for (const contact of results) {
          const { score, reasons } = calculateRiskScore(
            'propertyChange',
            'lastmodifieddate',
            null,
            contact.properties?.lastmodifieddate
          );

          const { error } = await supabase.from('hubspot_contact_changes').insert({
            contact_id: contact.id,
            contact_email: contact.properties?.email,
            event_type: 'modification',
            property_name: 'multiple',
            occurred_at: contact.properties?.lastmodifieddate || new Date().toISOString(),
            risk_score: score,
            risk_reasons: reasons,
            raw: contact,
          });

          if (!error) synced++;
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'sync-contacts',
          synced,
          total: results.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: unknown) {
        console.error('Contact sync error:', e);
        return new Response(JSON.stringify({
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ACTION: Full sync (logins + security + contacts)
    if (action === 'full-sync') {
      console.log('[Sync] Running full sync...');

      const results = {
        logins: { success: false, synced: 0 },
        security: { success: false, synced: 0 },
        contacts: { success: false, synced: 0 },
      };

      // Sync logins
      try {
        const data = await hubspotFetchAll('/account-info/v3/activity/login');
        let synced = 0;
        for (const event of (data || [])) {
          const { error } = await supabase.from('hubspot_login_activity').upsert({
            hubspot_id: event.id || `login_${event.occurredAt}_${event.userId}`,
            user_id: event.userId,
            user_email: event.userEmail,
            occurred_at: event.occurredAt,
            ip_address: event.ipAddress,
            user_agent: event.userAgent,
            location: event.location,
            login_type: event.loginType,
            raw: event,
          }, { onConflict: 'hubspot_id' });
          if (!error) synced++;
        }
        results.logins = { success: true, synced };
      } catch (e) {
        console.error('Login sync failed:', e);
      }

      // Sync security
      try {
        const data = await hubspotFetchAll('/account-info/v3/activity/security');
        let synced = 0;
        for (const event of (data || [])) {
          const { error } = await supabase.from('hubspot_security_activity').upsert({
            hubspot_id: event.id || `sec_${event.occurredAt}_${event.userId}`,
            user_id: event.userId,
            user_email: event.userEmail,
            event_type: event.eventType || 'unknown',
            occurred_at: event.occurredAt,
            ip_address: event.ipAddress,
            details: event.details,
            raw: event,
          }, { onConflict: 'hubspot_id' });
          if (!error) synced++;
        }
        results.security = { success: true, synced };
      } catch (e) {
        console.error('Security sync failed:', e);
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'full-sync',
        results,
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACTION: Aggregate daily summaries
    if (action === 'aggregate') {
      const targetDate = from || new Date().toISOString().split('T')[0];
      console.log(`[Aggregate] Computing summaries for ${targetDate}...`);

      // Get all unique users from activity
      const { data: logins } = await supabase
        .from('hubspot_login_activity')
        .select('user_id, user_email')
        .gte('occurred_at', `${targetDate}T00:00:00Z`)
        .lt('occurred_at', `${targetDate}T23:59:59Z`);

      const { data: security } = await supabase
        .from('hubspot_security_activity')
        .select('user_id, user_email, event_type')
        .gte('occurred_at', `${targetDate}T00:00:00Z`)
        .lt('occurred_at', `${targetDate}T23:59:59Z`);

      const { data: contactChanges } = await supabase
        .from('hubspot_contact_changes')
        .select('user_id, user_email, event_type, property_name, risk_score')
        .gte('occurred_at', `${targetDate}T00:00:00Z`)
        .lt('occurred_at', `${targetDate}T23:59:59Z`);

      // Aggregate by user
      const userStats: Record<string, any> = {};

      (logins || []).forEach(l => {
        const key = l.user_id || l.user_email || 'unknown';
        if (!userStats[key]) {
          userStats[key] = { user_id: l.user_id, user_email: l.user_email, logins: 0, exports: 0, security_events: 0, contact_creations: 0, contact_deletions: 0, contact_updates: 0, status_changes: 0, owner_changes: 0 };
        }
        userStats[key].logins++;
      });

      (security || []).forEach(s => {
        const key = s.user_id || s.user_email || 'unknown';
        if (!userStats[key]) {
          userStats[key] = { user_id: s.user_id, user_email: s.user_email, logins: 0, exports: 0, security_events: 0, contact_creations: 0, contact_deletions: 0, contact_updates: 0, status_changes: 0, owner_changes: 0 };
        }
        userStats[key].security_events++;
        if (s.event_type?.toLowerCase().includes('export')) {
          userStats[key].exports++;
        }
      });

      (contactChanges || []).forEach(c => {
        const key = c.user_id || c.user_email || 'unknown';
        if (!userStats[key]) {
          userStats[key] = { user_id: c.user_id, user_email: c.user_email, logins: 0, exports: 0, security_events: 0, contact_creations: 0, contact_deletions: 0, contact_updates: 0, status_changes: 0, owner_changes: 0 };
        }
        if (c.event_type === 'creation') userStats[key].contact_creations++;
        if (c.event_type === 'deletion') userStats[key].contact_deletions++;
        if (c.event_type === 'modification' || c.event_type === 'propertyChange') userStats[key].contact_updates++;
        if (c.property_name?.toLowerCase().includes('status')) userStats[key].status_changes++;
        if (c.property_name?.toLowerCase().includes('owner')) userStats[key].owner_changes++;
      });

      // Insert/update summaries
      let aggregated = 0;
      for (const [userId, stats] of Object.entries(userStats)) {
        const riskScore = (stats.exports * 3) + (stats.contact_deletions * 4) + (stats.status_changes * 2) + (stats.owner_changes * 2);
        const anomalies = detectAnomalies(stats);

        const { error } = await supabase.from('hubspot_user_daily_summary').upsert({
          summary_date: targetDate,
          user_id: stats.user_id || userId,
          user_email: stats.user_email,
          ...stats,
          risk_score: riskScore,
          anomaly_flags: anomalies,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'summary_date,user_id' });

        if (!error) aggregated++;
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'aggregate',
        date: targetDate,
        usersProcessed: Object.keys(userStats).length,
        aggregated,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACTION: Get overview data
    if (action === 'overview') {
      const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = to || new Date().toISOString().split('T')[0];

      const { data: summaries } = await supabase
        .from('hubspot_user_daily_summary')
        .select('*')
        .gte('summary_date', fromDate)
        .lte('summary_date', toDate)
        .order('risk_score', { ascending: false });

      const { data: recentLogins } = await supabase
        .from('hubspot_login_activity')
        .select('*')
        .gte('occurred_at', `${fromDate}T00:00:00Z`)
        .order('occurred_at', { ascending: false })
        .limit(50);

      const { data: recentSecurity } = await supabase
        .from('hubspot_security_activity')
        .select('*')
        .gte('occurred_at', `${fromDate}T00:00:00Z`)
        .order('occurred_at', { ascending: false })
        .limit(50);

      const { data: riskyChanges } = await supabase
        .from('hubspot_contact_changes')
        .select('*')
        .gte('risk_score', 3)
        .gte('occurred_at', `${fromDate}T00:00:00Z`)
        .order('risk_score', { ascending: false })
        .limit(100);

      // Calculate totals
      const totals = {
        totalLogins: (summaries || []).reduce((sum, s) => sum + (s.logins || 0), 0),
        totalExports: (summaries || []).reduce((sum, s) => sum + (s.exports || 0), 0),
        totalSecurityEvents: (summaries || []).reduce((sum, s) => sum + (s.security_events || 0), 0),
        totalContactCreations: (summaries || []).reduce((sum, s) => sum + (s.contact_creations || 0), 0),
        totalContactDeletions: (summaries || []).reduce((sum, s) => sum + (s.contact_deletions || 0), 0),
        totalStatusChanges: (summaries || []).reduce((sum, s) => sum + (s.status_changes || 0), 0),
        highRiskUsers: (summaries || []).filter(s => s.risk_score >= 10).length,
        usersWithAnomalies: (summaries || []).filter(s => (s.anomaly_flags || []).length > 0).length,
      };

      return new Response(JSON.stringify({
        success: true,
        action: 'overview',
        dateRange: { from: fromDate, to: toDate },
        totals,
        summaries: summaries || [],
        recentLogins: recentLogins || [],
        recentSecurity: recentSecurity || [],
        riskyChanges: riskyChanges || [],
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACTION: Get user detail
    if (action === 'user-detail') {
      if (!userEmail) {
        throw new Error('userEmail is required');
      }

      const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: summaries } = await supabase
        .from('hubspot_user_daily_summary')
        .select('*')
        .eq('user_email', userEmail)
        .gte('summary_date', fromDate)
        .order('summary_date', { ascending: false });

      const { data: logins } = await supabase
        .from('hubspot_login_activity')
        .select('*')
        .eq('user_email', userEmail)
        .gte('occurred_at', `${fromDate}T00:00:00Z`)
        .order('occurred_at', { ascending: false })
        .limit(50);

      const { data: security } = await supabase
        .from('hubspot_security_activity')
        .select('*')
        .eq('user_email', userEmail)
        .gte('occurred_at', `${fromDate}T00:00:00Z`)
        .order('occurred_at', { ascending: false })
        .limit(50);

      const { data: contactChanges } = await supabase
        .from('hubspot_contact_changes')
        .select('*')
        .eq('user_email', userEmail)
        .gte('occurred_at', `${fromDate}T00:00:00Z`)
        .order('occurred_at', { ascending: false })
        .limit(100);

      const totalRiskScore = (summaries || []).reduce((sum, s) => sum + (s.risk_score || 0), 0);
      const allAnomalies = (summaries || []).flatMap(s => s.anomaly_flags || []);

      return new Response(JSON.stringify({
        success: true,
        action: 'user-detail',
        userEmail,
        totalRiskScore,
        anomalies: [...new Set(allAnomalies)],
        summaries: summaries || [],
        logins: logins || [],
        security: security || [],
        contactChanges: contactChanges || [],
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACTION: Get risky contacts
    if (action === 'risky-contacts') {
      const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const minScore = minRiskScore || 3;

      const { data: riskyChanges } = await supabase
        .from('hubspot_contact_changes')
        .select('*')
        .gte('risk_score', minScore)
        .gte('occurred_at', `${fromDate}T00:00:00Z`)
        .order('risk_score', { ascending: false })
        .order('occurred_at', { ascending: false })
        .limit(200);

      return new Response(JSON.stringify({
        success: true,
        action: 'risky-contacts',
        minRiskScore: minScore,
        count: (riskyChanges || []).length,
        changes: riskyChanges || [],
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      error: 'Unknown action',
      availableActions: ['sync-logins', 'sync-security', 'sync-contacts', 'full-sync', 'aggregate', 'overview', 'user-detail', 'risky-contacts'],
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[HubSpot Command Center] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
