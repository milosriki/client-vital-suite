-- Phase 2: Add stripe_payment_id to deals for attribution chain
-- Answers: "Which Facebook ad made me money?"

ALTER TABLE deals ADD COLUMN IF NOT EXISTS stripe_payment_id text;
CREATE INDEX IF NOT EXISTS idx_deals_stripe_payment_id ON deals(stripe_payment_id);
