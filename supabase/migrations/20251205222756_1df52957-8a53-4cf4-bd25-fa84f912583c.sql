-- Add policies to tables with RLS enabled but no policies

CREATE POLICY "Admins can manage weekly_patterns"
ON public.weekly_patterns FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can manage table_name"
ON public.table_name FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());