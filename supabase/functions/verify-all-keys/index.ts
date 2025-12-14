// API Key Verification Function
// Verifies all API keys in Supabase and Vercel, checks which functions use them

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Required keys mapping: key_name -> functions that use it
const REQUIRED_KEYS = {
  // Supabase Secrets
  SUPABASE: {
    'ANTHROPIC_API_KEY': ['ptd-agent-claude', 'ptd-agent', 'churn-predictor', 'intervention-recommender', 'ptd-ultimate-intelligence'],
    'OPENAI_API_KEY': ['ptd-agent-claude', 'generate-embeddings', 'openai-embeddings'],
    'GOOGLE_API_KEY': ['ptd-agent-gemini', 'ptd-watcher', 'ptd-ultimate-intelligence'],
    'GEMINI_API_KEY': ['ptd-agent-gemini', 'ptd-watcher'],
    'GOOGLE_GEMINI_API_KEY': ['ptd-agent-gemini'],
    'HUBSPOT_API_KEY': ['sync-hubspot-to-supabase', 'sync-hubspot-to-capi', 'fetch-hubspot-live', 'reassign-owner', 'auto-reassign-leads'],
    'STRIPE_SECRET_KEY': ['stripe-dashboard-data', 'stripe-forensics', 'stripe-payouts-ai', 'enrich-with-stripe', 'stripe-webhook'],
    'STAPE_CAPIG_API_KEY': ['send-to-stape-capi', 'process-capi-batch'],
    'STAPE_CAPIG_ID': ['send-to-stape-capi', 'process-capi-batch'],
    'LOVABLE_API_KEY': ['smart-agent', 'stripe-payouts-ai'],
    'FB_PIXEL_ID': ['send-to-stape-capi', 'process-capi-batch'],
    'FB_ACCESS_TOKEN': ['send-to-stape-capi', 'process-capi-batch'],
    'META_ACCESS_TOKEN': ['send-to-stape-capi', 'process-capi-batch'],
    'CALLGEAR_API_KEY': ['call-tracking functions'],
  },
  // Vercel Environment Variables
  VERCEL: {
    'VITE_SUPABASE_URL': ['Frontend build'],
    'VITE_SUPABASE_PUBLISHABLE_KEY': ['Frontend build'],
    'VITE_GEMINI_API_KEY': ['Frontend build'],
    'FB_PIXEL_ID': ['API routes'],
    'FB_ACCESS_TOKEN': ['API routes'],
    'EVENT_SOURCE_URL': ['API routes'],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const report: any = {
      supabase_secrets: {},
      vercel_env_vars: {},
      missing_keys: [],
      unused_keys: [],
      key_usage_map: {},
      summary: {},
    };

    // Check Supabase Secrets (we can't list them directly, but we can check if functions can access them)
    console.log('[Key Verification] Checking Supabase secrets...');
    
    const supabaseSecretChecks: any = {};
    for (const [keyName, functions] of Object.entries(REQUIRED_KEYS.SUPABASE)) {
      // Try to access the secret (will be undefined if not set, but won't throw)
      const value = Deno.env.get(keyName);
      supabaseSecretChecks[keyName] = {
        set: !!value,
        set_length: value ? value.length : 0,
        used_by: functions,
        status: value ? '✅ SET' : '❌ MISSING',
      };

      if (!value) {
        report.missing_keys.push({
          platform: 'Supabase',
          key: keyName,
          used_by: functions,
          severity: 'critical',
        });
      }

      // Map key usage
      for (const func of functions) {
        if (!report.key_usage_map[func]) {
          report.key_usage_map[func] = [];
        }
        report.key_usage_map[func].push({
          key: keyName,
          platform: 'Supabase',
          status: value ? 'set' : 'missing',
        });
      }
    }

    report.supabase_secrets = supabaseSecretChecks;

    // Check Vercel Environment Variables (we can't access them from Edge Function, but document expected)
    console.log('[Key Verification] Documenting Vercel env vars...');
    
    const vercelEnvChecks: any = {};
    for (const [keyName, functions] of Object.entries(REQUIRED_KEYS.VERCEL)) {
      vercelEnvChecks[keyName] = {
        expected: true,
        used_by: functions,
        note: 'Cannot verify from Edge Function - check Vercel dashboard',
        status: '⚠️ CHECK MANUALLY',
      };
    }

    report.vercel_env_vars = vercelEnvChecks;

    // Summary
    const totalSupabaseKeys = Object.keys(REQUIRED_KEYS.SUPABASE).length;
    const setSupabaseKeys = Object.values(supabaseSecretChecks).filter((k: any) => k.set).length;
    const totalVercelKeys = Object.keys(REQUIRED_KEYS.VERCEL).length;

    report.summary = {
      supabase_total: totalSupabaseKeys,
      supabase_set: setSupabaseKeys,
      supabase_missing: totalSupabaseKeys - setSupabaseKeys,
      supabase_percentage: Math.round((setSupabaseKeys / totalSupabaseKeys) * 100),
      vercel_total: totalVercelKeys,
      vercel_note: 'Cannot verify from Edge Function',
      missing_keys_count: report.missing_keys.length,
      overall_status: report.missing_keys.length === 0 ? '✅ ALL KEYS SET' : '⚠️ SOME KEYS MISSING',
    };

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (report.missing_keys.length > 0) {
      recommendations.push(`❌ ${report.missing_keys.length} keys missing in Supabase`);
      for (const missing of report.missing_keys) {
        recommendations.push(`  - ${missing.key} (used by: ${missing.used_by.join(', ')})`);
      }
    } else {
      recommendations.push('✅ All Supabase secrets are set');
    }

    recommendations.push('⚠️ Verify Vercel env vars manually in Vercel dashboard');
    recommendations.push('📋 Check key_usage_map to see which functions need which keys');

    report.recommendations = recommendations;

    return new Response(
      JSON.stringify(report, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[Key Verification] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
