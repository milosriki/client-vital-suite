-- ============================================
-- SECURITY REMEDIATION MIGRATION
-- Addresses RLS policy improvements
-- ============================================

-- ============================================
-- 1. IMMEDIATE: Enable stricter RLS on sensitive tables
-- client_health_scores, coach_performance, intervention_log, daily_summary
-- ============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.client_health_scores;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.coach_performance;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.intervention_log;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.daily_summary;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.weekly_patterns;

-- Create authenticated-only read policies for sensitive tables
CREATE POLICY "Authenticated users can read client_health_scores"
ON public.client_health_scores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage client_health_scores"
ON public.client_health_scores
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read coach_performance"
ON public.coach_performance
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage coach_performance"
ON public.coach_performance
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read intervention_log"
ON public.intervention_log
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert intervention_log"
ON public.intervention_log
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can manage intervention_log"
ON public.intervention_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read daily_summary"
ON public.daily_summary
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage daily_summary"
ON public.daily_summary
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read weekly_patterns"
ON public.weekly_patterns
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage weekly_patterns"
ON public.weekly_patterns
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. Update agent tables to use authenticated policies
-- ============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.agent_knowledge;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.agent_conversations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.agent_decisions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.proactive_insights;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.agent_metrics;

-- Create proper authenticated policies for agent tables
CREATE POLICY "Authenticated users can read agent_knowledge"
ON public.agent_knowledge
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage agent_knowledge"
ON public.agent_knowledge
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read agent_conversations"
ON public.agent_conversations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert agent_conversations"
ON public.agent_conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can manage agent_conversations"
ON public.agent_conversations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read agent_decisions"
ON public.agent_decisions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert agent_decisions"
ON public.agent_decisions
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update agent_decisions"
ON public.agent_decisions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage agent_decisions"
ON public.agent_decisions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read proactive_insights"
ON public.proactive_insights
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update proactive_insights"
ON public.proactive_insights
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage proactive_insights"
ON public.proactive_insights
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read agent_metrics"
ON public.agent_metrics
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage agent_metrics"
ON public.agent_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- NOTES:
-- - All tables now require authentication for read access
-- - Write operations are restricted to service_role (edge functions)
-- - Authenticated users can insert/update where appropriate
-- - Edge functions use SUPABASE_SERVICE_ROLE_KEY and bypass RLS
-- ============================================
