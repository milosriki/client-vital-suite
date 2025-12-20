import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  latencyMs: number;
  message?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const checks: HealthCheck[] = [];
  const startTime = Date.now();

  // Check 1: Environment variables
  const envCheck = checkEnvVars();
  checks.push(envCheck);

  if (envCheck.status === 'fail') {
    return res.status(503).json({
      ok: false,
      status: 'unhealthy',
      checks,
      totalMs: Date.now() - startTime,
    });
  }

  // Check 2: Supabase connection
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  checks.push(await checkTable(supabase, 'contacts'));
  checks.push(await checkTable(supabase, 'agent_memory'));
  checks.push(await checkRPC(supabase, 'match_memories'));

  // Determine overall status
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (failCount >= 2) status = 'unhealthy';
  else if (failCount >= 1 || warnCount >= 2) status = 'degraded';

  return res.status(status === 'unhealthy' ? 503 : 200).json({
    ok: status !== 'unhealthy',
    status,
    checks,
    totalMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  });
}

function checkEnvVars(): HealthCheck {
  const start = Date.now();
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);

  return {
    name: 'env_vars',
    status: missing.length === 0 ? 'pass' : 'fail',
    latencyMs: Date.now() - start,
    message: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined,
  };
}

async function checkTable(supabase: SupabaseClient, table: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { error } = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
    return {
      name: `table_${table}`,
      status: error ? 'fail' : 'pass',
      latencyMs: Date.now() - start,
      message: error?.message,
    };
  } catch (e: any) {
    return {
      name: `table_${table}`,
      status: 'fail',
      latencyMs: Date.now() - start,
      message: e.message,
    };
  }
}

async function checkRPC(supabase: SupabaseClient, rpc: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Just verify the function exists by calling with empty params
    const { error } = await supabase.rpc(rpc, {
      query_embedding: new Array(1536).fill(0),
      threshold: 0.99,
      count: 1,
    });
    return {
      name: `rpc_${rpc}`,
      status: error ? 'warn' : 'pass', // warn because empty embedding might fail
      latencyMs: Date.now() - start,
      message: error?.message,
    };
  } catch (e: any) {
    return {
      name: `rpc_${rpc}`,
      status: 'warn',
      latencyMs: Date.now() - start,
      message: e.message,
    };
  }
}
