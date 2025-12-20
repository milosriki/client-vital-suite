import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAuth, getSupabase, success, error } from './_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ptd-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  const auth = checkAuth(req);
  if (!auth.authorized) {
    return error(res, 'UNAUTHORIZED', auth.error!, 401, undefined, startTime);
  }

  const supabase = getSupabase();

  try {
    // ========================================
    // GET: Read memory
    // ========================================
    if (req.method === 'GET') {
      const namespace = (req.query.namespace as string) || 'global';
      const key = req.query.key as string | undefined;

      let query = supabase
        .from('org_memory_kv')
        .select('namespace, key, value, source, updated_at, expires_at')
        .eq('namespace', namespace)
        .or('expires_at.is.null,expires_at.gt.now()'); // Not expired

      if (key) {
        query = query.eq('key', key);
      }

      const { data, error: dbError } = await query.order('updated_at', { ascending: false });

      if (dbError) throw dbError;

      return success(res, key ? data?.[0] || null : data, startTime);
    }

    // ========================================
    // POST: Write memory
    // ========================================
    if (req.method === 'POST') {
      const { namespace = 'global', key, value, ttlSeconds, source = 'manual' } = req.body || {};

      if (!key) return error(res, 'INVALID_INPUT', 'key is required', 400, undefined, startTime);
      if (value === undefined) return error(res, 'INVALID_INPUT', 'value is required', 400, undefined, startTime);

      // Get existing value for audit log
      const { data: existing } = await supabase
        .from('org_memory_kv')
        .select('value')
        .eq('namespace', namespace)
        .eq('key', key)
        .single();

      // Upsert the value
      const { data, error: dbError } = await supabase
        .from('org_memory_kv')
        .upsert(
          {
            namespace,
            key,
            value,
            ttl_seconds: ttlSeconds,
            source,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'namespace,key' },
        )
        .select()
        .single();

      if (dbError) throw dbError;

      // Log the event
      await supabase.from('org_memory_events').insert({
        event_type: 'write',
        namespace,
        key,
        value_before: existing?.value,
        value_after: value,
        source,
      });

      return success(res, data, startTime);
    }

    // ========================================
    // DELETE: Remove memory
    // ========================================
    if (req.method === 'DELETE') {
      const namespace = (req.query.namespace as string) || 'global';
      const key = req.query.key as string | undefined;

      if (!key) return error(res, 'INVALID_INPUT', 'key is required', 400, undefined, startTime);

      // Get existing value for audit log
      const { data: existing } = await supabase
        .from('org_memory_kv')
        .select('value')
        .eq('namespace', namespace)
        .eq('key', key)
        .single();

      const { error: dbError } = await supabase
        .from('org_memory_kv')
        .delete()
        .eq('namespace', namespace)
        .eq('key', key);

      if (dbError) throw dbError;

      // Log the event
      if (existing) {
        await supabase.from('org_memory_events').insert({
          event_type: 'delete',
          namespace,
          key,
          value_before: existing.value,
          value_after: null,
          source: 'api',
        });
      }

      return success(res, { deleted: !!existing }, startTime);
    }

    return error(res, 'METHOD_NOT_ALLOWED', 'Use GET, POST, or DELETE', 405, undefined, startTime);
  } catch (err: any) {
    console.error('[MEMORY ERROR]', err?.message || err);
    return error(res, 'MEMORY_FAILED', err?.message || 'Unknown error', 500, undefined, startTime);
  }
}
