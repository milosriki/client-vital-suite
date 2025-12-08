-- Migration: Contact Owner Intelligence System
-- Description: Add owner change tracking and history to client_health_scores
-- Date: 2025-12-08

-- =====================================================
-- PART 1: Extend client_health_scores table
-- =====================================================

-- Add owner tracking columns to client_health_scores
ALTER TABLE public.client_health_scores
ADD COLUMN IF NOT EXISTS owner_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS previous_owner TEXT,
ADD COLUMN IF NOT EXISTS owner_change_count INTEGER DEFAULT 0;

-- Add comment to document the new columns
COMMENT ON COLUMN public.client_health_scores.owner_changed_at IS 'Timestamp when the assigned coach/owner was last changed';
COMMENT ON COLUMN public.client_health_scores.previous_owner IS 'The previous assigned coach before the last change';
COMMENT ON COLUMN public.client_health_scores.owner_change_count IS 'Total number of times the owner has changed for this client';

-- =====================================================
-- PART 2: Create contact_owner_history table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.contact_owner_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  old_owner TEXT,
  new_owner TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  health_before NUMERIC,
  health_after NUMERIC,
  health_zone_before TEXT,
  health_zone_after TEXT,
  reason TEXT,
  triggered_intervention BOOLEAN DEFAULT FALSE,
  intervention_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_owner_history_client
ON public.contact_owner_history(client_email);

CREATE INDEX IF NOT EXISTS idx_owner_history_date
ON public.contact_owner_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_owner_history_new_owner
ON public.contact_owner_history(new_owner);

CREATE INDEX IF NOT EXISTS idx_owner_history_old_owner
ON public.contact_owner_history(old_owner);

-- Add comments
COMMENT ON TABLE public.contact_owner_history IS 'Tracks complete history of contact owner/coach changes with health impact analysis';
COMMENT ON COLUMN public.contact_owner_history.client_email IS 'Email of the client whose owner changed';
COMMENT ON COLUMN public.contact_owner_history.old_owner IS 'Previous owner/coach name or ID';
COMMENT ON COLUMN public.contact_owner_history.new_owner IS 'New owner/coach name or ID';
COMMENT ON COLUMN public.contact_owner_history.health_before IS 'Client health score before owner change';
COMMENT ON COLUMN public.contact_owner_history.health_after IS 'Client health score after owner change (recorded later)';
COMMENT ON COLUMN public.contact_owner_history.reason IS 'Reason for owner change (hubspot_sync, manual, etc)';
COMMENT ON COLUMN public.contact_owner_history.triggered_intervention IS 'Whether this change triggered an automatic intervention';

-- =====================================================
-- PART 3: Enable RLS and create policies
-- =====================================================

-- Enable Row Level Security
ALTER TABLE public.contact_owner_history ENABLE ROW LEVEL SECURITY;

-- Create policy for read access
CREATE POLICY "Enable read access for all authenticated users"
ON public.contact_owner_history
FOR SELECT
TO authenticated
USING (true);

-- Create policy for insert access (for edge functions)
CREATE POLICY "Enable insert for service role"
ON public.contact_owner_history
FOR INSERT
TO service_role
WITH CHECK (true);

-- Create policy for update access (for service role to update health_after)
CREATE POLICY "Enable update for service role"
ON public.contact_owner_history
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PART 4: Create trigger for updated_at
-- =====================================================

CREATE TRIGGER update_contact_owner_history_updated_at
BEFORE UPDATE ON public.contact_owner_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PART 5: Create helper function for owner change detection
-- =====================================================

CREATE OR REPLACE FUNCTION public.detect_owner_change(
  p_client_email TEXT,
  p_new_owner TEXT,
  p_current_health NUMERIC DEFAULT NULL,
  p_current_zone TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_old_owner TEXT;
  v_old_health NUMERIC;
  v_old_zone TEXT;
  v_change_count INTEGER;
  v_changed BOOLEAN := FALSE;
  v_history_id UUID;
  v_result JSON;
BEGIN
  -- Get current owner and health from client_health_scores
  SELECT
    assigned_coach,
    health_score,
    health_zone,
    COALESCE(owner_change_count, 0)
  INTO
    v_old_owner,
    v_old_health,
    v_old_zone,
    v_change_count
  FROM public.client_health_scores
  WHERE email = p_client_email;

  -- Check if owner changed
  IF v_old_owner IS DISTINCT FROM p_new_owner THEN
    v_changed := TRUE;
    v_change_count := v_change_count + 1;

    -- Insert into history
    INSERT INTO public.contact_owner_history (
      client_email,
      old_owner,
      new_owner,
      changed_at,
      health_before,
      health_zone_before,
      health_after,
      health_zone_after,
      reason
    ) VALUES (
      p_client_email,
      v_old_owner,
      p_new_owner,
      NOW(),
      v_old_health,
      v_old_zone,
      p_current_health,
      p_current_zone,
      'hubspot_sync'
    ) RETURNING id INTO v_history_id;

    -- Update client_health_scores
    UPDATE public.client_health_scores
    SET
      assigned_coach = p_new_owner,
      previous_owner = v_old_owner,
      owner_changed_at = NOW(),
      owner_change_count = v_change_count,
      updated_at = NOW()
    WHERE email = p_client_email;
  END IF;

  -- Build result
  v_result := json_build_object(
    'changed', v_changed,
    'old_owner', v_old_owner,
    'new_owner', p_new_owner,
    'change_count', v_change_count,
    'history_id', v_history_id,
    'should_intervene', v_changed AND v_change_count > 1
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.detect_owner_change IS 'Detects and records owner changes, returns whether change occurred and if intervention needed';

-- =====================================================
-- PART 6: Create analytics view for owner change insights
-- =====================================================

CREATE OR REPLACE VIEW public.owner_change_insights AS
SELECT
  new_owner,
  COUNT(*) as total_changes,
  COUNT(*) FILTER (WHERE health_after < health_before) as health_drops,
  COUNT(*) FILTER (WHERE health_after >= health_before) as health_maintained,
  AVG(health_before) as avg_health_before,
  AVG(health_after) as avg_health_after,
  AVG(health_after - health_before) as avg_health_impact,
  COUNT(DISTINCT client_email) as unique_clients,
  MIN(changed_at) as first_assignment,
  MAX(changed_at) as latest_assignment
FROM public.contact_owner_history
WHERE changed_at >= NOW() - INTERVAL '90 days'
GROUP BY new_owner;

-- Add comment
COMMENT ON VIEW public.owner_change_insights IS 'Analytics view showing owner change patterns and health impact by coach';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
