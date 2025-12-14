-- Add more HubSpot contact fields for enhanced lead/contact information
-- Priority fields: company, deals, custom properties, engagement scores

-- Company Information
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_id TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS company_domain TEXT;

-- Deal & Revenue Information
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS associated_deal_ids TEXT[],
ADD COLUMN IF NOT EXISTS total_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_associated_deals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_deal_created_date TIMESTAMPTZ;

-- Custom Properties (PTD-specific)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS assigned_coach TEXT,
ADD COLUMN IF NOT EXISTS assessment_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assessment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS package_type TEXT,
ADD COLUMN IF NOT EXISTS sessions_purchased INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS outstanding_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coach_notes TEXT,
ADD COLUMN IF NOT EXISTS preferred_location TEXT,
ADD COLUMN IF NOT EXISTS fitness_goals TEXT;

-- Engagement Scores & Analytics
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS analytics_score INTEGER,
ADD COLUMN IF NOT EXISTS facebook_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS twitter_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS linkedin_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_notes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_meetings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_emails INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_emails_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_emails_opened INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_emails_clicked INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_email_sent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_email_opened_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_email_clicked_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_meeting_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_meeting_date TIMESTAMPTZ;

-- Communication Preferences
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS language TEXT;

-- Social Media
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS linkedin_bio TEXT,
ADD COLUMN IF NOT EXISTS linkedin_connections INTEGER,
ADD COLUMN IF NOT EXISTS twitter_followers INTEGER;

-- Additional Analytics
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS num_visits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_page_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_event_completions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_visit_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_name ON public.contacts(company_name);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_coach ON public.contacts(assigned_coach);
CREATE INDEX IF NOT EXISTS idx_contacts_assessment_date ON public.contacts(assessment_date);
CREATE INDEX IF NOT EXISTS idx_contacts_total_deal_value ON public.contacts(total_deal_value DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_analytics_score ON public.contacts(analytics_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_last_meeting_date ON public.contacts(last_meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_next_meeting_date ON public.contacts(next_meeting_date DESC);

-- Comments for documentation
COMMENT ON COLUMN public.contacts.company_name IS 'Company name from HubSpot';
COMMENT ON COLUMN public.contacts.assigned_coach IS 'Assigned coach/setter name';
COMMENT ON COLUMN public.contacts.assessment_scheduled IS 'Whether assessment is scheduled';
COMMENT ON COLUMN public.contacts.total_deal_value IS 'Total value of all associated deals';
COMMENT ON COLUMN public.contacts.analytics_score IS 'HubSpot analytics engagement score';
