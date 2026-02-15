-- Add contact_id foreign key to stripe_transactions
-- This enables linking revenue back to specific leads/contacts

ALTER TABLE public.stripe_transactions
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_contact_id ON public.stripe_transactions(contact_id);

-- Comment
COMMENT ON COLUMN public.stripe_transactions.contact_id IS 'Link to public.contacts for attribution';
