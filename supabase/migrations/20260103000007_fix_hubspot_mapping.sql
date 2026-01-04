-- Migration to fix HubSpot sync errors by adding proper mapping columns
-- 1. Fix Deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS hubspot_deal_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS deals_hubspot_deal_id_idx ON public.deals (hubspot_deal_id);

-- 2. Fix Appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS hubspot_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_hubspot_event_id_idx ON public.appointments (hubspot_event_id);

-- 3. Ensure contacts has index for performance
CREATE UNIQUE INDEX IF NOT EXISTS contacts_hubspot_contact_id_idx ON public.contacts (hubspot_contact_id);
