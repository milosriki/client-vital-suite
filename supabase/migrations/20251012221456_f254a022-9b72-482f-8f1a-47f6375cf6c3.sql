-- Create intervention_log table
CREATE TABLE public.intervention_log (
  id BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT,
  intervention_type TEXT NOT NULL,
  intervention_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_coach TEXT,
  status TEXT DEFAULT 'pending',
  ai_recommendation TEXT,
  outcome TEXT,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  success_rating INTEGER CHECK (success_rating >= 1 AND success_rating <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weekly_patterns table
CREATE TABLE public.weekly_patterns (
  id BIGSERIAL PRIMARY KEY,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_clients INTEGER,
  green_clients INTEGER,
  yellow_clients INTEGER,
  red_clients INTEGER,
  purple_clients INTEGER,
  avg_health_score NUMERIC,
  clients_improving INTEGER,
  clients_declining INTEGER,
  pattern_insights TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create coach_performance table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.coach_performance (
  id BIGSERIAL PRIMARY KEY,
  coach_name TEXT NOT NULL,
  report_date DATE NOT NULL,
  total_clients INTEGER DEFAULT 0,
  avg_health_score NUMERIC,
  red_clients INTEGER DEFAULT 0,
  yellow_clients INTEGER DEFAULT 0,
  green_clients INTEGER DEFAULT 0,
  purple_clients INTEGER DEFAULT 0,
  clients_improving INTEGER DEFAULT 0,
  clients_declining INTEGER DEFAULT 0,
  trend TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily_summary table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.daily_summary (
  id BIGSERIAL PRIMARY KEY,
  summary_date DATE NOT NULL UNIQUE,
  total_active_clients INTEGER DEFAULT 0,
  avg_health_score NUMERIC,
  critical_interventions INTEGER DEFAULT 0,
  at_risk_revenue NUMERIC DEFAULT 0,
  red_clients INTEGER DEFAULT 0,
  yellow_clients INTEGER DEFAULT 0,
  green_clients INTEGER DEFAULT 0,
  purple_clients INTEGER DEFAULT 0,
  red_percentage NUMERIC DEFAULT 0,
  yellow_percentage NUMERIC DEFAULT 0,
  green_percentage NUMERIC DEFAULT 0,
  purple_percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.intervention_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow read access for now)
CREATE POLICY "Enable read access for all users" ON public.intervention_log
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.weekly_patterns
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.coach_performance
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.daily_summary
  FOR SELECT USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_intervention_log_updated_at
  BEFORE UPDATE ON public.intervention_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_patterns_updated_at
  BEFORE UPDATE ON public.weekly_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coach_performance_updated_at
  BEFORE UPDATE ON public.coach_performance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_summary_updated_at
  BEFORE UPDATE ON public.daily_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();