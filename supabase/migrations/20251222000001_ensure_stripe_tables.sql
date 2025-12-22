-- Ensure all Stripe tables exist for the full setup

-- 1. Stripe Events (Log of all webhooks)
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    api_version TEXT,
    livemode BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB,
    request_id TEXT,
    idempotency_key TEXT,
    raw_event JSONB
);
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at ON stripe_events(created_at DESC);

-- 2. Stripe Transactions (Payments/Charges)
CREATE TABLE IF NOT EXISTS public.stripe_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    amount DECIMAL(10, 2),
    currency TEXT,
    status TEXT,
    payment_method TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    failure_reason TEXT,
    charge_id TEXT,
    description TEXT,
    amount_refunded DECIMAL(10, 2) DEFAULT 0,
    refunded BOOLEAN DEFAULT FALSE,
    refund_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_stripe_id ON stripe_transactions(stripe_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_customer_id ON stripe_transactions(customer_id);

-- 3. Stripe Refunds (handled in previous migration but ensuring here)
CREATE TABLE IF NOT EXISTS public.stripe_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    charge_id TEXT,
    payment_intent_id TEXT,
    customer_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'AED',
    status TEXT NOT NULL,
    reason TEXT,
    receipt_number TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Stripe Subscriptions
CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    status TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_stripe_id ON stripe_subscriptions(stripe_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer_id ON stripe_subscriptions(customer_id);

-- 5. Stripe Invoices
CREATE TABLE IF NOT EXISTS public.stripe_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    subscription_id TEXT,
    amount_paid DECIMAL(10, 2),
    amount_due DECIMAL(10, 2),
    currency TEXT,
    status TEXT,
    paid BOOLEAN,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_stripe_id ON stripe_invoices(stripe_id);

-- 6. Stripe Payouts
CREATE TABLE IF NOT EXISTS public.stripe_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    amount DECIMAL(10, 2),
    currency TEXT,
    status TEXT,
    arrival_date TIMESTAMPTZ,
    destination TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Stripe Accounts (Connect)
CREATE TABLE IF NOT EXISTS public.stripe_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    type TEXT,
    country TEXT,
    email TEXT,
    business_type TEXT,
    charges_enabled BOOLEAN,
    payouts_enabled BOOLEAN,
    details_submitted BOOLEAN,
    requirements JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Stripe Account Persons
CREATE TABLE IF NOT EXISTS public.stripe_account_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    account_id TEXT,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    relationship JSONB,
    verification JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Stripe Money Management
CREATE TABLE IF NOT EXISTS public.stripe_money_management (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    type TEXT,
    financial_account TEXT,
    amount DECIMAL(10, 2),
    currency TEXT,
    status TEXT,
    flow_type TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Stripe Financial Accounts
CREATE TABLE IF NOT EXISTS public.stripe_financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    status TEXT,
    supported_payment_method_types JSONB,
    features JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Stripe Billing Meters
CREATE TABLE IF NOT EXISTS public.stripe_billing_meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT,
    meter_id TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Stripe Account Links
CREATE TABLE IF NOT EXISTS public.stripe_account_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_id TEXT UNIQUE NOT NULL,
    account TEXT,
    return_url TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Stripe Fraud Alerts
CREATE TABLE IF NOT EXISTS public.stripe_fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT,
    event_type TEXT,
    risk_score DECIMAL(5, 2),
    signals TEXT[],
    account_id TEXT,
    customer_id TEXT,
    transaction_id TEXT,
    payout_id TEXT,
    amount DECIMAL(10, 2),
    destination TEXT,
    severity TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_account_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_money_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_billing_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_fraud_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies (Admin only for now, can be adjusted)
CREATE POLICY "Admin full access stripe_events" ON stripe_events FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_transactions" ON stripe_transactions FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_subscriptions" ON stripe_subscriptions FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_invoices" ON stripe_invoices FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_payouts" ON stripe_payouts FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_accounts" ON stripe_accounts FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_account_persons" ON stripe_account_persons FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_money_management" ON stripe_money_management FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_financial_accounts" ON stripe_financial_accounts FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_billing_meters" ON stripe_billing_meters FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_account_links" ON stripe_account_links FOR ALL USING (is_admin());
CREATE POLICY "Admin full access stripe_fraud_alerts" ON stripe_fraud_alerts FOR ALL USING (is_admin());

-- Enable Realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_events;
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_fraud_alerts;
