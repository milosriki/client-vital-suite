-- ============================================
-- INTERVENTION FEEDBACK TRIGGER
-- Auto-creates feedback learning rows when interventions are completed
-- ============================================

-- ============================================
-- SCHEMA DOCUMENTATION (from information_schema queries)
-- ============================================
/*
intervention_log columns (confirmed):
  - id (bigint, PK)
  - client_email (text, NOT NULL)
  - email (text, NOT NULL)
  - intervention_type (text, NOT NULL)
  - status (text, default 'PENDING')
  - outcome (text, nullable)
  - health_score_at_trigger (numeric)
  - health_zone_at_trigger (text)
  - health_score_before (numeric)
  - health_score_after (numeric)
  - ai_recommendation (text)
  - ai_confidence (numeric)
  - success_probability (numeric)
  - completed_at (timestamptz)
  - created_at (timestamptz)

ai_feedback_learning columns (confirmed):
  - id (uuid, PK)
  - insight_id (uuid, nullable)
  - intervention_id (bigint, nullable) -- links to intervention_log.id
  - feedback_type (text, NOT NULL)
  - feedback_score (integer, nullable)
  - user_correction (text, nullable)
  - context_data (jsonb, default '{}')
  - insight_type (text, nullable)
  - original_recommendation (text, nullable)
  - corrected_recommendation (text, nullable)
  - feedback_notes (text, nullable)
  - created_by (text, nullable)
  - created_at (timestamptz, default now())
  - applied_to_model (boolean, default false)
  - applied_at (timestamptz, nullable)
*/

-- ============================================
-- TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.intervention_feedback_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_feedback_type TEXT;
  v_feedback_score INTEGER;
  v_context JSONB;
  v_exists BOOLEAN;
BEGIN
  -- Only fire when status='completed' OR outcome IS NOT NULL (and was NULL before)
  IF NOT (
    (NEW.status = 'completed' OR LOWER(NEW.status) = 'completed') 
    OR 
    (NEW.outcome IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.outcome IS NULL))
  ) THEN
    RETURN NEW;
  END IF;

  -- Check if feedback already exists for this intervention
  SELECT EXISTS (
    SELECT 1 FROM public.ai_feedback_learning 
    WHERE intervention_id = NEW.id
  ) INTO v_exists;

  IF v_exists THEN
    -- Already has feedback, skip to avoid duplicates
    RETURN NEW;
  END IF;

  -- Determine feedback type based on outcome
  v_feedback_type := CASE
    WHEN NEW.outcome IS NOT NULL THEN 'intervention_outcome'
    ELSE 'intervention_completed'
  END;

  -- Calculate feedback score based on outcome (if available)
  -- Positive outcomes get higher scores
  v_feedback_score := CASE
    WHEN LOWER(COALESCE(NEW.outcome, '')) LIKE '%success%' THEN 5
    WHEN LOWER(COALESCE(NEW.outcome, '')) LIKE '%positive%' THEN 4
    WHEN LOWER(COALESCE(NEW.outcome, '')) LIKE '%neutral%' THEN 3
    WHEN LOWER(COALESCE(NEW.outcome, '')) LIKE '%negative%' THEN 2
    WHEN LOWER(COALESCE(NEW.outcome, '')) LIKE '%fail%' THEN 1
    WHEN NEW.health_score_after IS NOT NULL AND NEW.health_score_before IS NOT NULL THEN
      CASE
        WHEN NEW.health_score_after > NEW.health_score_before THEN 4
        WHEN NEW.health_score_after = NEW.health_score_before THEN 3
        ELSE 2
      END
    ELSE 3 -- Default neutral
  END;

  -- Build context data from available columns
  v_context := jsonb_build_object(
    'intervention_id', NEW.id,
    'client_email', NEW.email,
    'intervention_type', NEW.intervention_type,
    'status', NEW.status,
    'outcome', NEW.outcome,
    'health_score_at_trigger', NEW.health_score_at_trigger,
    'health_zone_at_trigger', NEW.health_zone_at_trigger,
    'health_score_before', NEW.health_score_before,
    'health_score_after', NEW.health_score_after,
    'success_probability', NEW.success_probability,
    'ai_confidence', NEW.ai_confidence,
    'completed_at', NEW.completed_at,
    'triggered_at', NEW.triggered_at
  );

  -- Insert feedback learning row
  INSERT INTO public.ai_feedback_learning (
    intervention_id,
    feedback_type,
    feedback_score,
    context_data,
    insight_type,
    original_recommendation,
    feedback_notes,
    created_by,
    created_at,
    applied_to_model
  ) VALUES (
    NEW.id,
    v_feedback_type,
    v_feedback_score,
    v_context,
    NEW.intervention_type,
    NEW.ai_recommendation,
    COALESCE(NEW.notes, NEW.owner_notes),
    'system_trigger',
    NOW(),
    FALSE
  );

  RAISE NOTICE '[intervention_feedback_trigger] Created feedback for intervention %', NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the original operation
  RAISE WARNING '[intervention_feedback_trigger] Error creating feedback for intervention %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DROP EXISTING TRIGGER (idempotent)
-- ============================================
DROP TRIGGER IF EXISTS trg_intervention_feedback ON public.intervention_log;

-- ============================================
-- CREATE TRIGGER
-- ============================================
CREATE TRIGGER trg_intervention_feedback
  AFTER INSERT OR UPDATE OF status, outcome
  ON public.intervention_log
  FOR EACH ROW
  EXECUTE FUNCTION public.intervention_feedback_trigger_fn();

-- ============================================
-- ADD INDEX FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ai_feedback_intervention_id 
  ON public.ai_feedback_learning(intervention_id);

CREATE INDEX IF NOT EXISTS idx_intervention_log_status_outcome 
  ON public.intervention_log(status, outcome) 
  WHERE status = 'completed' OR outcome IS NOT NULL;

-- ============================================
-- DOCUMENTATION
-- ============================================
COMMENT ON FUNCTION public.intervention_feedback_trigger_fn() IS 
  'Auto-creates ai_feedback_learning rows when intervention_log.status=completed OR outcome IS NOT NULL. Safe to re-run.';

COMMENT ON TRIGGER trg_intervention_feedback ON public.intervention_log IS 
  'Fires on INSERT or UPDATE of status/outcome columns to create feedback learning records.';

