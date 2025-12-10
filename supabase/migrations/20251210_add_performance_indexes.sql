-- Speed up client health queries
CREATE INDEX IF NOT EXISTS idx_health_zone_date ON client_health_scores(health_zone, calculated_on DESC);
CREATE INDEX IF NOT EXISTS idx_risk_category ON client_health_scores(risk_category, predictive_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_coach_date ON client_health_scores(assigned_coach, calculated_on DESC);

-- Speed up lead queries
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_ai_reply ON leads(ai_suggested_reply) WHERE ai_suggested_reply IS NULL;

-- Speed up intervention queries
CREATE INDEX IF NOT EXISTS idx_intervention_status ON intervention_log(status, created_at DESC);
