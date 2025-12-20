import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * System Check Endpoint - /api/system-check
 * 
 * Verifies the entire deployment is correctly wired:
 * - Vercel environment variables exist
 * - Supabase connection works (server-side)
 * - No localhost references in production
 * 
 * Usage: curl https://client-vital-suite.vercel.app/api/system-check
 */

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

interface SystemCheckResponse {
  timestamp: string;
  environment: string;
  overall: 'pass' | 'fail';
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[system-check] Request received', {
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent']?.substring(0, 50),
  });

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const checks: CheckResult[] = [];

  // ==========================================
  // CHECK 1: Frontend Environment Variables (VITE_*)
  // ==========================================
  const viteSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const viteSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const viteSupabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  console.log('[system-check] Checking VITE_* env vars:', {
    VITE_SUPABASE_URL: viteSupabaseUrl ? 'present' : 'missing',
    VITE_SUPABASE_ANON_KEY: viteSupabaseAnonKey ? 'present' : 'missing',
    VITE_SUPABASE_PUBLISHABLE_KEY: viteSupabasePublishableKey ? 'present' : 'missing',
  });

  checks.push({
    name: 'VITE_SUPABASE_URL',
    status: viteSupabaseUrl ? 'pass' : 'fail',
    message: viteSupabaseUrl ? `Set (${viteSupabaseUrl.substring(0, 30)}...)` : 'Missing - frontend cannot connect to Supabase',
  });

  checks.push({
    name: 'VITE_SUPABASE_ANON_KEY',
    status: viteSupabaseAnonKey ? 'pass' : 'warn',
    message: viteSupabaseAnonKey ? 'Present (legacy)' : 'Missing (may use VITE_SUPABASE_PUBLISHABLE_KEY instead)',
  });

  checks.push({
    name: 'VITE_SUPABASE_PUBLISHABLE_KEY',
    status: viteSupabasePublishableKey ? 'pass' : 'warn',
    message: viteSupabasePublishableKey ? 'Present' : 'Missing (may use VITE_SUPABASE_ANON_KEY instead)',
  });

  // ==========================================
  // CHECK 2: Server-side Environment Variables
  // ==========================================
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[system-check] Checking server-side env vars:', {
    SUPABASE_URL: supabaseUrl ? 'present' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey ? 'present' : 'missing',
  });

  checks.push({
    name: 'SUPABASE_URL',
    status: supabaseUrl ? 'pass' : 'fail',
    message: supabaseUrl ? `Set (${supabaseUrl.substring(0, 30)}...)` : 'Missing - API routes cannot connect to Supabase',
  });

  checks.push({
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    status: supabaseServiceRoleKey ? 'pass' : 'fail',
    message: supabaseServiceRoleKey ? 'Present (not exposed)' : 'Missing - API routes cannot authenticate',
  });

  // ==========================================
  // CHECK 3: No localhost in URL configs
  // ==========================================
  const urlsToCheck = [
    { name: 'VITE_SUPABASE_URL', value: viteSupabaseUrl },
    { name: 'SUPABASE_URL', value: supabaseUrl },
  ];

  for (const { name, value } of urlsToCheck) {
    if (value) {
      const hasLocalhost = value.includes('localhost') || value.includes('127.0.0.1');
      checks.push({
        name: `${name}_no_localhost`,
        status: hasLocalhost ? 'fail' : 'pass',
        message: hasLocalhost 
          ? `CRITICAL: ${name} points to localhost - will fail in production!` 
          : 'URL does not contain localhost',
      });
    }
  }

  // ==========================================
  // CHECK 4: Supabase Database Connection Test
  // ==========================================
  let dbConnectionResult: CheckResult = {
    name: 'supabase_db_connection',
    status: 'fail',
    message: 'Not tested - missing credentials',
  };

  if (supabaseUrl && supabaseServiceRoleKey) {
    try {
      console.log('[system-check] Testing Supabase DB connection...');
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
      
      // Simple query to test connection - get count from a common table
      const { count, error } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log('[system-check] DB connection error:', error.message);
        dbConnectionResult = {
          name: 'supabase_db_connection',
          status: 'fail',
          message: `Connection failed: ${error.message}`,
        };
      } else {
        console.log('[system-check] DB connection successful, contacts count:', count);
        dbConnectionResult = {
          name: 'supabase_db_connection',
          status: 'pass',
          message: `Connected successfully (contacts table: ${count} rows)`,
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log('[system-check] DB connection exception:', errorMsg);
      dbConnectionResult = {
        name: 'supabase_db_connection',
        status: 'fail',
        message: `Exception: ${errorMsg}`,
      };
    }
  }
  checks.push(dbConnectionResult);

  // ==========================================
  // CHECK 5: Supabase Edge Function Test (verify-all-keys)
  // ==========================================
  let edgeFunctionResult: CheckResult = {
    name: 'supabase_edge_function',
    status: 'warn',
    message: 'Not tested - missing credentials',
  };

  if (supabaseUrl && supabaseServiceRoleKey) {
    try {
      console.log('[system-check] Testing Edge Function (verify-all-keys)...');
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-all-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({}),
      });

      const responseText = await response.text();
      
      if (response.ok) {
        console.log('[system-check] Edge Function call successful');
        let parsed;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = { raw: responseText.substring(0, 100) };
        }
        
        edgeFunctionResult = {
          name: 'supabase_edge_function',
          status: 'pass',
          message: `verify-all-keys responded (${response.status})`,
        };
      } else {
        console.log('[system-check] Edge Function returned error:', response.status, responseText.substring(0, 100));
        edgeFunctionResult = {
          name: 'supabase_edge_function',
          status: response.status === 404 ? 'warn' : 'fail',
          message: `verify-all-keys returned ${response.status}: ${responseText.substring(0, 50)}`,
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log('[system-check] Edge Function exception:', errorMsg);
      edgeFunctionResult = {
        name: 'supabase_edge_function',
        status: 'warn',
        message: `Could not reach Edge Function: ${errorMsg.substring(0, 50)}`,
      };
    }
  }
  checks.push(edgeFunctionResult);

  // ==========================================
  // SUMMARY
  // ==========================================
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;

  const overall = failed > 0 ? 'fail' : 'pass';

  const response: SystemCheckResponse = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    overall,
    checks,
    summary: {
      total: checks.length,
      passed,
      failed,
      warnings,
    },
  };

  console.log('[system-check] Complete:', {
    overall,
    passed,
    failed,
    warnings,
  });

  return res.status(overall === 'pass' ? 200 : 500).json(response);
}

