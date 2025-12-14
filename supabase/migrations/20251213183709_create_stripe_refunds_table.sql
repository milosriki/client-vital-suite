-- Create stripe_refunds table to automatically track all refunds
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

-- Add refund tracking to stripe_transactions
ALTER TABLE public.stripe_transactions 
  ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS refund_status TEXT;

-- Indexes for fast refund queries
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_stripe_id ON stripe_refunds(stripe_id);
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_charge_id ON stripe_refunds(charge_id);
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_customer_id ON stripe_refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_created_at ON stripe_refunds(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_status ON stripe_refunds(status);

-- Enable RLS
ALTER TABLE stripe_refunds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin full access stripe_refunds" ON stripe_refunds FOR ALL USING (is_admin());
CREATE POLICY "Public read stripe_refunds" ON stripe_refunds FOR SELECT USING (true);

-- Update trigger
CREATE OR REPLACE FUNCTION update_stripe_refunds_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stripe_refunds_updated_at BEFORE UPDATE ON stripe_refunds FOR EACH ROW EXECUTE FUNCTION update_stripe_refunds_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_refunds;
