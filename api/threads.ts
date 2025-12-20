import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAuth, getSupabase, success, error } from './_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ptd-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = checkAuth(req);
  if (!auth.authorized) {
    return error(res, 'UNAUTHORIZED', auth.error!, 401, undefined, startTime);
  }

  const supabase = getSupabase();

  try {
    // GET: List threads or get single thread with messages
    if (req.method === 'GET') {
      const id = req.query.id as string | undefined;

      if (id) {
        // Get single thread with messages
        const [threadResult, messagesResult] = await Promise.all([
          supabase.from('org_threads').select('*').eq('id', id).single(),
          supabase
            .from('org_messages')
            .select('id, role, content, evidence, sources_used, created_at')
            .eq('thread_id', id)
            .order('created_at', { ascending: true }),
        ]);

        if (threadResult.error) throw threadResult.error;

        return success(
          res,
          {
            ...threadResult.data,
            messages: messagesResult.data || [],
          },
          startTime,
        );
      }

      // List recent threads
      const { data, error: dbError } = await supabase
        .from('org_threads')
        .select('id, thread_name, created_by, last_message_at')
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (dbError) throw dbError;

      return success(res, data, startTime);
    }

    // POST: Create new thread
    if (req.method === 'POST') {
      const { name, createdBy = 'anonymous' } = req.body || {};

      const { data, error: dbError } = await supabase
        .from('org_threads')
        .insert({
          thread_name: name || `Thread ${new Date().toLocaleDateString()}`,
          created_by: createdBy,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      return success(res, data, startTime);
    }

    return error(res, 'METHOD_NOT_ALLOWED', 'Use GET or POST', 405, undefined, startTime);
  } catch (err: any) {
    console.error('[THREADS ERROR]', err?.message || err);
    return error(res, 'THREADS_FAILED', err?.message || 'Unknown error', 500, undefined, startTime);
  }
}
