
-- Add missing HubSpot fields to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS latest_traffic_source text,
ADD COLUMN IF NOT EXISTS latest_traffic_source_2 text,
ADD COLUMN IF NOT EXISTS call_attempt_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_lifecycle_stage text,
ADD COLUMN IF NOT EXISTS speed_to_lead_minutes integer,
ADD COLUMN IF NOT EXISTS first_outbound_call_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS delegation_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS lead_status text,
ADD COLUMN IF NOT EXISTS owner_name text,
ADD COLUMN IF NOT EXISTS segment_memberships text[];

-- Create contact_activities table to track timeline events
CREATE TABLE IF NOT EXISTS public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id),
  hubspot_contact_id TEXT,
  activity_type TEXT NOT NULL,
  activity_title TEXT,
  activity_description TEXT,
  performed_by TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_activities
CREATE POLICY "Admin full access contact_activities" 
ON public.contact_activities FOR ALL USING (is_admin());

CREATE POLICY "Public read contact_activities" 
ON public.contact_activities FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_activities_contact ON public.contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_hubspot ON public.contact_activities(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_type ON public.contact_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_contact_activities_occurred ON public.contact_activities(occurred_at DESC);

-- Add index for location searches
CREATE INDEX IF NOT EXISTS idx_contacts_location ON public.contacts(location);
CREATE INDEX IF NOT EXISTS idx_contacts_neighborhood ON public.contacts(neighborhood);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id);
