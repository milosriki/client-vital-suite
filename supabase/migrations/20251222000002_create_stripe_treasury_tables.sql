-- Create table for Stripe Treasury Outbound Transfers
CREATE TABLE IF NOT EXISTS stripe_outbound_transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_id TEXT UNIQUE NOT NULL,
    financial_account_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT,
    statement_descriptor TEXT,
    destination_payment_method_id TEXT,
    destination_payment_method_details JSONB,
    expected_arrival_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    raw_response JSONB
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stripe_outbound_transfers_stripe_id ON stripe_outbound_transfers(stripe_id);
CREATE INDEX IF NOT EXISTS idx_stripe_outbound_transfers_status ON stripe_outbound_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stripe_outbound_transfers_financial_account ON stripe_outbound_transfers(financial_account_id);

-- Enable RLS
ALTER TABLE stripe_outbound_transfers ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view transfers
CREATE POLICY "Users can view their own outbound transfers" ON stripe_outbound_transfers
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy for service role to manage transfers
CREATE POLICY "Service role can manage outbound transfers" ON stripe_outbound_transfers
    FOR ALL USING (auth.role() = 'service_role');
