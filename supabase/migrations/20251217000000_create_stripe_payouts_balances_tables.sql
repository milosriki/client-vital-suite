-- Create stripe_payouts table for tracking payout data
-- This table is used by stripe-webhook and tools.yaml queries
CREATE TABLE IF NOT EXISTS public.stripe_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'AED',
  status TEXT NOT NULL,
  arrival_date TIMESTAMPTZ,
  destination TEXT,
  description TEXT,
  failure_code TEXT,
  failure_message TEXT,
  method TEXT,
  source_type TEXT,
  statement_descriptor TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_balances table for tracking balance snapshots
CREATE TABLE IF NOT EXISTS public.stripe_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  available_amount DECIMAL(12, 2) DEFAULT 0,
  available_currency TEXT DEFAULT 'AED',
  pending_amount DECIMAL(12, 2) DEFAULT 0,
  pending_currency TEXT DEFAULT 'AED',
  reserved_amount DECIMAL(12, 2) DEFAULT 0,
  reserved_currency TEXT DEFAULT 'AED',
  instant_available_amount DECIMAL(12, 2) DEFAULT 0,
  livemode BOOLEAN DEFAULT TRUE,
  raw_balance JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_accounts table for connected accounts (if not exists)
CREATE TABLE IF NOT EXISTS public.stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_id TEXT UNIQUE NOT NULL,
  type TEXT,
  country TEXT,
  email TEXT,
  business_type TEXT,
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,
  requirements JSONB DEFAULT '{}'::jsonb,
  capabilities JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_account_persons table for account persons
CREATE TABLE IF NOT EXISTS public.stripe_account_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_id TEXT UNIQUE NOT NULL,
  account_id TEXT REFERENCES stripe_accounts(stripe_id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  relationship JSONB DEFAULT '{}'::jsonb,
  verification JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_money_management table for treasury transactions
CREATE TABLE IF NOT EXISTS public.stripe_money_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_id TEXT UNIQUE NOT NULL,
  type TEXT,
  financial_account TEXT,
  amount DECIMAL(12, 2),
  currency TEXT DEFAULT 'AED',
  status TEXT,
  flow_type TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_financial_accounts table
CREATE TABLE IF NOT EXISTS public.stripe_financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_id TEXT UNIQUE NOT NULL,
  status TEXT,
  supported_payment_method_types TEXT[],
  features JSONB DEFAULT '{}'::jsonb,
  balance JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_billing_meters table
CREATE TABLE IF NOT EXISTS public.stripe_billing_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id TEXT,
  event_type TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_account_links table
CREATE TABLE IF NOT EXISTS public.stripe_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_id TEXT UNIQUE NOT NULL,
  account TEXT,
  return_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_fraud_alerts table for fraud detection
CREATE TABLE IF NOT EXISTS public.stripe_fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  event_type TEXT,
  risk_score INTEGER DEFAULT 0,
  signals TEXT[] DEFAULT ARRAY[]::TEXT[],
  account_id TEXT,
  customer_id TEXT,
  transaction_id TEXT,
  payout_id TEXT,
  amount DECIMAL(12, 2),
  destination TEXT,
  severity TEXT DEFAULT 'low',
  status TEXT DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_stripe_payouts_stripe_id ON stripe_payouts(stripe_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payouts_status ON stripe_payouts(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payouts_created_at ON stripe_payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_payouts_destination ON stripe_payouts(destination);

CREATE INDEX IF NOT EXISTS idx_stripe_balances_snapshot_at ON stripe_balances(snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_accounts_stripe_id ON stripe_accounts(stripe_id);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_email ON stripe_accounts(email);

CREATE INDEX IF NOT EXISTS idx_stripe_fraud_alerts_event_id ON stripe_fraud_alerts(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_fraud_alerts_severity ON stripe_fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_stripe_fraud_alerts_status ON stripe_fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_stripe_fraud_alerts_risk_score ON stripe_fraud_alerts(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_fraud_alerts_created_at ON stripe_fraud_alerts(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE stripe_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_account_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_money_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_billing_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_fraud_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin full access, public read for reporting
CREATE POLICY "Admin full access stripe_payouts" ON stripe_payouts FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_payouts" ON stripe_payouts FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_balances" ON stripe_balances FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_balances" ON stripe_balances FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_accounts" ON stripe_accounts FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_accounts" ON stripe_accounts FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_account_persons" ON stripe_account_persons FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_account_persons" ON stripe_account_persons FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_money_management" ON stripe_money_management FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_money_management" ON stripe_money_management FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_financial_accounts" ON stripe_financial_accounts FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_financial_accounts" ON stripe_financial_accounts FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_billing_meters" ON stripe_billing_meters FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_billing_meters" ON stripe_billing_meters FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_account_links" ON stripe_account_links FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_account_links" ON stripe_account_links FOR SELECT USING (true);

CREATE POLICY "Admin full access stripe_fraud_alerts" ON stripe_fraud_alerts FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_fraud_alerts" ON stripe_fraud_alerts FOR SELECT USING (true);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_stripe_payouts_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_stripe_accounts_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_stripe_fraud_alerts_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stripe_payouts_updated_at BEFORE UPDATE ON stripe_payouts
FOR EACH ROW EXECUTE FUNCTION update_stripe_payouts_updated_at();

CREATE TRIGGER stripe_accounts_updated_at BEFORE UPDATE ON stripe_accounts
FOR EACH ROW EXECUTE FUNCTION update_stripe_accounts_updated_at();

CREATE TRIGGER stripe_account_persons_updated_at BEFORE UPDATE ON stripe_account_persons
FOR EACH ROW EXECUTE FUNCTION update_stripe_accounts_updated_at();

CREATE TRIGGER stripe_money_management_updated_at BEFORE UPDATE ON stripe_money_management
FOR EACH ROW EXECUTE FUNCTION update_stripe_payouts_updated_at();

CREATE TRIGGER stripe_financial_accounts_updated_at BEFORE UPDATE ON stripe_financial_accounts
FOR EACH ROW EXECUTE FUNCTION update_stripe_payouts_updated_at();

CREATE TRIGGER stripe_fraud_alerts_updated_at BEFORE UPDATE ON stripe_fraud_alerts
FOR EACH ROW EXECUTE FUNCTION update_stripe_fraud_alerts_updated_at();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_payouts;
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_fraud_alerts;

COMMENT ON TABLE stripe_payouts IS 'Tracks Stripe payout events from webhooks';
COMMENT ON TABLE stripe_balances IS 'Snapshots of Stripe account balance';
COMMENT ON TABLE stripe_fraud_alerts IS 'AI-detected fraud signals from Stripe events';
