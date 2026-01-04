-- Create a table to track Contact Ownership History if it doesn't exist
CREATE TABLE IF NOT EXISTS public.contact_ownership_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id),
    old_owner_name TEXT,
    new_owner_name TEXT,
    changed_by TEXT, -- AI or Human Email
    change_reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup in CEO Dashboard
CREATE INDEX IF NOT EXISTS idx_ownership_contact ON public.contact_ownership_history(contact_id);
