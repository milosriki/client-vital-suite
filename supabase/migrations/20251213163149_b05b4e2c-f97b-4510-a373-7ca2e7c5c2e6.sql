-- Create prepared_actions table for AI CEO system
CREATE TABLE public.prepared_actions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type TEXT NOT NULL DEFAULT 'general',
    action_title TEXT NOT NULL,
    action_description TEXT,
    reasoning TEXT,
    expected_impact TEXT,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence NUMERIC DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    prepared_payload JSONB,
    supporting_data JSONB,
    status TEXT DEFAULT 'prepared' CHECK (status IN ('prepared', 'executing', 'executed', 'failed', 'rejected')),
    priority INTEGER DEFAULT 5,
    source_agent TEXT DEFAULT 'ai-ceo-master',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    executed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT
);

-- Create business_goals table
CREATE TABLE public.business_goals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    goal_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    baseline_value NUMERIC DEFAULT 0,
    current_value NUMERIC DEFAULT 0,
    target_value NUMERIC NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused', 'abandoned')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create business_calibration table for AI learning
CREATE TABLE public.business_calibration (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    scenario_description TEXT NOT NULL,
    ai_recommendation TEXT,
    your_decision TEXT,
    was_ai_correct BOOLEAN DEFAULT false,
    feedback_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prepared_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_calibration ENABLE ROW LEVEL SECURITY;

-- Create policies for public read (since this is an internal business tool)
CREATE POLICY "Allow all access to prepared_actions" ON public.prepared_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to business_goals" ON public.business_goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to business_calibration" ON public.business_calibration FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_prepared_actions_status ON public.prepared_actions(status);
CREATE INDEX idx_prepared_actions_priority ON public.prepared_actions(priority DESC);
CREATE INDEX idx_business_goals_status ON public.business_goals(status);

-- Add timestamp trigger
CREATE TRIGGER update_business_goals_updated_at
    BEFORE UPDATE ON public.business_goals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();