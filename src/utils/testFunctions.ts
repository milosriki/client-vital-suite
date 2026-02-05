/**
 * Function Testing Utility
 * Test all Edge Functions from browser console
 */

import { supabase } from '@/integrations/supabase/client';

export interface FunctionTestResult {
  functionName: string;
  success: boolean;
  error?: string;
  response?: any;
  duration: number;
}

/**
 * Test a single function
 */
export async function testFunction(
  functionName: string,
  body: any = {}
): Promise<FunctionTestResult> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    const duration = Date.now() - startTime;

    if (error) {
      return {
        functionName,
        success: false,
        error: error.message || JSON.stringify(error),
        duration
      };
    }

    return {
      functionName,
      success: true,
      response: data,
      duration
    };
  } catch (err: any) {
    return {
      functionName,
      success: false,
      error: err.message || 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

/**
 * Test all critical functions
 */
export async function testAllFunctions(): Promise<FunctionTestResult[]> {
  const functions = [
    { name: 'health-calculator', body: {} },
    { name: 'ptd-agent-gemini', body: { query: 'test', session_id: 'test-' + Date.now() } },
    { name: 'business-intelligence', body: {} },
    { name: 'sync-hubspot-to-supabase', body: { sync_type: 'contacts', incremental: true } },
    { name: 'fetch-hubspot-live', body: {} },
    { name: 'stripe-dashboard-data', body: {} },
    { name: 'ptd-watcher', body: {} },
    { name: 'integration-health', body: {} },
  ];

  const results: FunctionTestResult[] = [];

  for (const func of functions) {
    
    const result = await testFunction(func.name, func.body);
    results.push(result);
    
  }

  return results;
}

/**
 * Quick test - test one function
 */
export async function quickTest(functionName: string = 'health-calculator') {
  
  const result = await testFunction(functionName);
  
  if (result.success) {
    
  } else {
    console.error('❌ Failed:', result.error);
  }
  
  return result;
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).testFunction = testFunction;
  (window as any).testAllFunctions = testAllFunctions;
  (window as any).quickTest = quickTest;
  
  
  
  
}
