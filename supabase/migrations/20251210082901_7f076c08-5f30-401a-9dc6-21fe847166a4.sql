-- Add additional HubSpot contact fields for form submissions, SLA, and engagement tracking
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS first_conversion_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS num_form_submissions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_unique_forms_submitted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS recent_conversion text,
ADD COLUMN IF NOT EXISTS recent_conversion_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS contact_unworked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS count_of_reassignations integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS hubspot_team text,
ADD COLUMN IF NOT EXISTS last_activity_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS sla_first_touch text,
ADD COLUMN IF NOT EXISTS time_of_entry timestamp with time zone,
ADD COLUMN IF NOT EXISTS member_accessed_private_content integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS registered_member integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_domain text,
ADD COLUMN IF NOT EXISTS currently_in_prospecting boolean DEFAULT false;

-- Add index for SLA tracking queries
CREATE INDEX IF NOT EXISTS idx_contacts_sla_first_touch ON public.contacts(sla_first_touch);
CREATE INDEX IF NOT EXISTS idx_contacts_hubspot_team ON public.contacts(hubspot_team);