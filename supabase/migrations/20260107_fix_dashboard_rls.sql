-- Fix Dashboard Access: Enable RLS and allow public read access
-- This ensures Vercel (using anon key) can read the status data

-- 1. sync_logs
ALTER TABLE IF EXISTS public.sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to sync_logs" ON public.sync_logs;
CREATE POLICY "Allow public read access to sync_logs" ON public.sync_logs FOR SELECT USING (true);

-- 2. sync_queue
ALTER TABLE IF EXISTS public.sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to sync_queue" ON public.sync_queue;
CREATE POLICY "Allow public read access to sync_queue" ON public.sync_queue FOR SELECT USING (true);

-- 3. sync_errors
ALTER TABLE IF EXISTS public.sync_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to sync_errors" ON public.sync_errors;
CREATE POLICY "Allow public read access to sync_errors" ON public.sync_errors FOR SELECT USING (true);
