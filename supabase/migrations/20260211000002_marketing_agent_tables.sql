-- Marketing Agent System Tables
-- Stores signals, recommendations, and proposals from the 5-agent War Room

-- Agent signals (from Scout)
CREATE TABLE IF NOT EXISTS marketing_agent_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('fatigue', 'ghost_spike', 'new_winner', 'spend_anomaly', 'creative_opportunity')),
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  campaign_name TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'opportunity')),
  evidence JSONB DEFAULT '{}'::jsonb,
  agent_name TEXT NOT NULL DEFAULT 'scout',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analyst recommendations
CREATE TABLE IF NOT EXISTS marketing_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('SCALE', 'HOLD', 'WATCH', 'KILL', 'REFRESH')),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  reasoning TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,
  signal_id UUID REFERENCES marketing_agent_signals(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget proposals (from Allocator)
CREATE TABLE IF NOT EXISTS marketing_budget_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  current_daily_budget NUMERIC(10,2),
  proposed_daily_budget NUMERIC(10,2),
  change_pct NUMERIC(5,2),
  action TEXT NOT NULL CHECK (action IN ('increase', 'decrease', 'pause', 'maintain')),
  recommendation_id UUID REFERENCES marketing_recommendations(id),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'executed')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creative library (from Copywriter)
CREATE TABLE IF NOT EXISTS creative_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_ad_id TEXT,
  source_ad_name TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'v1.0.0',
  headlines JSONB NOT NULL DEFAULT '[]'::jsonb,
  bodies JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasoning TEXT,
  winning_dna JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'published')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fatigue alerts (from Predictor)
CREATE TABLE IF NOT EXISTS marketing_fatigue_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  ctr_today NUMERIC(5,3),
  ctr_3d_avg NUMERIC(5,3),
  ctr_delta_pct NUMERIC(5,2),
  projected_revenue_30d NUMERIC(12,2),
  projected_spend_30d NUMERIC(12,2),
  projected_roas_30d NUMERIC(6,3),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('fatigue', 'opportunity', 'trend_reversal')),
  recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily CEO briefing snapshots
CREATE TABLE IF NOT EXISTS daily_marketing_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_date DATE NOT NULL UNIQUE,
  yesterday_spend NUMERIC(10,2),
  yesterday_leads INTEGER,
  yesterday_cpl NUMERIC(10,2),
  yesterday_assessments INTEGER,
  yesterday_true_cpa NUMERIC(10,2),
  rolling_7d_spend NUMERIC(12,2),
  rolling_7d_revenue NUMERIC(12,2),
  rolling_7d_roas NUMERIC(6,3),
  rolling_7d_avg_health NUMERIC(5,2),
  rolling_7d_ghost_rate NUMERIC(5,2),
  actions_required JSONB DEFAULT '[]'::jsonb,
  budget_proposals JSONB DEFAULT '[]'::jsonb,
  fatigue_alerts JSONB DEFAULT '[]'::jsonb,
  projection_30d JSONB DEFAULT '{}'::jsonb,
  new_copy_pending INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only service role can write (agents run as service role)
ALTER TABLE marketing_agent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_budget_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_fatigue_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_marketing_briefs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (CEO dashboard)
CREATE POLICY "Authenticated users can read signals"
  ON marketing_agent_signals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read recommendations"
  ON marketing_recommendations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read budget proposals"
  ON marketing_budget_proposals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read creative library"
  ON creative_library FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read fatigue alerts"
  ON marketing_fatigue_alerts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read daily briefs"
  ON daily_marketing_briefs FOR SELECT
  TO authenticated USING (true);

-- CEO can approve/reject recommendations and proposals
CREATE POLICY "Authenticated users can update recommendations"
  ON marketing_recommendations FOR UPDATE
  TO authenticated USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update budget proposals"
  ON marketing_budget_proposals FOR UPDATE
  TO authenticated USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update creative library"
  ON creative_library FOR UPDATE
  TO authenticated USING (true)
  WITH CHECK (true);

COMMENT ON TABLE marketing_agent_signals IS 'Signals from the Scout agent: anomalies, fatigue, winners';
COMMENT ON TABLE marketing_recommendations IS 'SCALE/HOLD/KILL recommendations from the Analyst agent';
COMMENT ON TABLE marketing_budget_proposals IS 'Budget change proposals from the Allocator agent (require CEO approval)';
COMMENT ON TABLE creative_library IS 'AI-generated ad copy variants from the Copywriter agent (require CEO approval)';
COMMENT ON TABLE marketing_fatigue_alerts IS 'Creative fatigue warnings and 30-day projections from the Predictor agent';
COMMENT ON TABLE daily_marketing_briefs IS 'Daily CEO briefing snapshots aggregating all agent outputs';
