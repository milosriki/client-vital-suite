
-- AI Feedback Learning Table - stores user feedback on AI suggestions to improve future recommendations
CREATE TABLE IF NOT EXISTS public.ai_feedback_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID REFERENCES public.proactive_insights(id) ON DELETE SET NULL,
  intervention_id BIGINT REFERENCES public.intervention_log(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'partially_helpful', 'wrong', 'outdated')),
  feedback_score INTEGER CHECK (feedback_score BETWEEN 1 AND 5),
  user_correction TEXT,
  context_data JSONB DEFAULT '{}'::jsonb,
  insight_type TEXT,
  original_recommendation TEXT,
  corrected_recommendation TEXT,
  feedback_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  applied_to_model BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ
);

-- AI Learning Rules Table - stores learned patterns from feedback
CREATE TABLE IF NOT EXISTS public.ai_learning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL, -- 'lead_scoring', 'call_timing', 'intervention', 'routing'
  condition_pattern JSONB NOT NULL,
  action_pattern JSONB NOT NULL,
  confidence_score NUMERIC DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'user_feedback',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add working hours rules from the HubSpot playbook
CREATE TABLE IF NOT EXISTS public.business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  rule_category TEXT NOT NULL, -- 'working_hours', 'task_management', 'phone_routing', 'reassignment'
  rule_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert the business rules from your HubSpot playbook
INSERT INTO public.business_rules (rule_name, rule_category, rule_config) VALUES
('working_hours', 'working_hours', '{"timezone": "Asia/Dubai", "start_hour": 10, "end_hour": 20, "freeze_tasks_outside": true, "freeze_reassignment_outside": true}'::jsonb),
('task_minimization', 'task_management', '{"allowed_tasks": ["Schedule Discovery Call", "Second Double Dial", "Reactivation Task", "Re-delegation During Shift"], "blocked_triggers": ["email_click", "email_open", "lifecycle_change", "overnight_rotation"], "one_task_per_contact": true}'::jsonb),
('international_routing', 'phone_routing', '{"normalize_to_e164": true, "uae_only_main_queue": true, "international_queue_enabled": true, "target_regions": ["UAE", "KSA", "UK"]}'::jsonb),
('sla_reassignment', 'reassignment', '{"sla_minutes": 30, "close_prior_tasks": true, "create_single_new_task": true, "business_hours_only": true}'::jsonb)
ON CONFLICT (rule_name) DO UPDATE SET rule_config = EXCLUDED.rule_config, updated_at = now();

-- Enable RLS
ALTER TABLE public.ai_feedback_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin full access ai_feedback_learning" ON public.ai_feedback_learning FOR ALL USING (is_admin());
CREATE POLICY "Public read ai_feedback_learning" ON public.ai_feedback_learning FOR SELECT USING (true);
CREATE POLICY "Public insert ai_feedback_learning" ON public.ai_feedback_learning FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin full access ai_learning_rules" ON public.ai_learning_rules FOR ALL USING (is_admin());
CREATE POLICY "Public read ai_learning_rules" ON public.ai_learning_rules FOR SELECT USING (true);

CREATE POLICY "Admin full access business_rules" ON public.business_rules FOR ALL USING (is_admin());
CREATE POLICY "Public read business_rules" ON public.business_rules FOR SELECT USING (true);

-- Function to update learning rules based on feedback
CREATE OR REPLACE FUNCTION public.update_learning_from_feedback()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Update or create a learning rule based on the feedback
  INSERT INTO public.ai_learning_rules (rule_type, condition_pattern, action_pattern, confidence_score, usage_count, success_count, source)
  VALUES (
    COALESCE(NEW.insight_type, 'general'),
    NEW.context_data,
    jsonb_build_object('corrected', NEW.corrected_recommendation, 'original', NEW.original_recommendation),
    CASE 
      WHEN NEW.feedback_type = 'helpful' THEN 0.9
      WHEN NEW.feedback_type = 'partially_helpful' THEN 0.6
      WHEN NEW.feedback_type = 'not_helpful' THEN 0.2
      WHEN NEW.feedback_type = 'wrong' THEN 0.1
      ELSE 0.5
    END,
    1,
    CASE WHEN NEW.feedback_type IN ('helpful', 'partially_helpful') THEN 1 ELSE 0 END,
    'user_feedback'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_learning
AFTER INSERT ON public.ai_feedback_learning
FOR EACH ROW EXECUTE FUNCTION public.update_learning_from_feedback();
