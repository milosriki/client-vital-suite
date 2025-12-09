-- HubSpot Command Center Tables

-- Login Activity (persisted from HubSpot API)
CREATE TABLE public.hubspot_login_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE,
  user_id TEXT,
  user_email TEXT,
  occurred_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  login_type TEXT,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Security Activity (exports, token views, etc.)
CREATE TABLE public.hubspot_security_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE,
  user_id TEXT,
  user_email TEXT,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ,
  ip_address TEXT,
  details TEXT,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contact Changes (for lead risk tracking)
CREATE TABLE public.hubspot_contact_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT NOT NULL,
  contact_email TEXT,
  event_type TEXT NOT NULL,
  property_name TEXT,
  old_value TEXT,
  new_value TEXT,
  occurred_at TIMESTAMPTZ DEFAULT now(),
  user_id TEXT,
  user_email TEXT,
  risk_score INTEGER DEFAULT 0,
  risk_reasons TEXT[],
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily User Summary (aggregated metrics)
CREATE TABLE public.hubspot_user_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  logins INTEGER DEFAULT 0,
  exports INTEGER DEFAULT 0,
  security_events INTEGER DEFAULT 0,
  contact_creations INTEGER DEFAULT 0,
  contact_deletions INTEGER DEFAULT 0,
  contact_updates INTEGER DEFAULT 0,
  status_changes INTEGER DEFAULT 0,
  owner_changes INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  anomaly_flags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(summary_date, user_id)
);

-- Indexes for performance
CREATE INDEX idx_hubspot_login_occurred ON hubspot_login_activity(occurred_at DESC);
CREATE INDEX idx_hubspot_login_user ON hubspot_login_activity(user_email);
CREATE INDEX idx_hubspot_security_occurred ON hubspot_security_activity(occurred_at DESC);
CREATE INDEX idx_hubspot_security_user ON hubspot_security_activity(user_email);
CREATE INDEX idx_hubspot_security_type ON hubspot_security_activity(event_type);
CREATE INDEX idx_hubspot_contact_changes_risk ON hubspot_contact_changes(risk_score DESC);
CREATE INDEX idx_hubspot_contact_changes_occurred ON hubspot_contact_changes(occurred_at DESC);
CREATE INDEX idx_hubspot_contact_changes_contact ON hubspot_contact_changes(contact_id);
CREATE INDEX idx_hubspot_summary_date ON hubspot_user_daily_summary(summary_date DESC);
CREATE INDEX idx_hubspot_summary_user ON hubspot_user_daily_summary(user_email);
CREATE INDEX idx_hubspot_summary_risk ON hubspot_user_daily_summary(risk_score DESC);

-- Enable RLS
ALTER TABLE public.hubspot_login_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_security_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_contact_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_user_daily_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
CREATE POLICY "Admins can manage hubspot_login_activity" ON public.hubspot_login_activity FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage hubspot_security_activity" ON public.hubspot_security_activity FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage hubspot_contact_changes" ON public.hubspot_contact_changes FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage hubspot_user_daily_summary" ON public.hubspot_user_daily_summary FOR ALL USING (is_admin());