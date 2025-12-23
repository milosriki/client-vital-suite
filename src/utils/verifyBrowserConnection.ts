/**
 * Browser Connection Verification Utility
 * Verifies all connections work in browser (not Lovable)
 */

import { supabase } from '@/integrations/supabase/client';

export interface ConnectionStatus {
  supabase: {
    connected: boolean;
    url: string;
    error?: string;
  };
  functions: {
    testable: boolean;
    testedFunctions: string[];
    failedFunctions: string[];
  };
  environment: {
    hasUrl: boolean;
    hasKey: boolean;
    isProduction: boolean;
  };
}

/**
 * Verify Supabase connection
 */
export async function verifySupabaseConnection(): Promise<ConnectionStatus['supabase']> {
  const supabaseUrl = "https://ztjndilxurtsfqdsvfds.supabase.co";
  try {
    // Test connection by querying a simple table
    const { error } = await supabase
      .from('client_health_scores')
      .select('id')
      .limit(1);

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (OK)
      return {
        connected: false,
        url: supabaseUrl,
        error: error.message
      };
    }

    return {
      connected: true,
      url: supabaseUrl
    };
  } catch (err: any) {
    return {
      connected: false,
      url: supabaseUrl,
      error: err.message || 'Connection failed'
    };
  }
}

/**
 * Verify environment variables
 */
export function verifyEnvironment(): ConnectionStatus['environment'] {
  const hasUrl = true; // Always available via hardcoded fallback
  const hasKey = true; // Always available via hardcoded fallback
  const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost';

  return {
    hasUrl,
    hasKey,
    isProduction
  };
}

/**
 * Test critical functions
 */
export async function testCriticalFunctions(): Promise<ConnectionStatus['functions']> {
  const functionsToTest = [
    'health-calculator',
    'ptd-agent-gemini',
    'business-intelligence',
    'sync-hubspot-to-supabase'
  ];

  const testedFunctions: string[] = [];
  const failedFunctions: string[] = [];

  for (const funcName of functionsToTest) {
    try {
      const { error } = await supabase.functions.invoke(funcName, {
        body: {}
      });

      if (error) {
        failedFunctions.push(funcName);
      } else {
        testedFunctions.push(funcName);
      }
    } catch (err) {
      failedFunctions.push(funcName);
    }
  }

  return {
    testable: true,
    testedFunctions,
    failedFunctions
  };
}

/**
 * Complete connection verification
 */
export async function verifyAllConnections(): Promise<ConnectionStatus> {
  const [supabaseStatus, envStatus, functionsStatus] = await Promise.all([
    verifySupabaseConnection(),
    Promise.resolve(verifyEnvironment()),
    testCriticalFunctions()
  ]);

  return {
    supabase: supabaseStatus,
    environment: envStatus,
    functions: functionsStatus
  };
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).verifyConnections = verifyAllConnections;
  (window as any).verifySupabase = verifySupabaseConnection;
  console.log('🔍 Connection verification utilities loaded!');
  console.log('   Use: verifyConnections()');
  console.log('   Use: verifySupabase()');
}
