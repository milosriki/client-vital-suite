-- ============================================================
-- Create security_alerts table for CallGear Sentinel
-- Stores real-time security alerts from call monitoring
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL DEFAULT 'callgear_sentinel',
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    call_session_id TEXT,
    caller_number TEXT,
    called_number TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON public.security_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_source ON public.security_alerts(source);
CREATE INDEX IF NOT EXISTS idx_security_alerts_call_session ON public.security_alerts(call_session_id);

-- Enable RLS
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access security_alerts" 
  ON public.security_alerts 
  FOR ALL 
  USING (true);

COMMENT ON TABLE public.security_alerts IS 'Real-time security alerts from CallGear Sentinel and Stripe Forensics';
