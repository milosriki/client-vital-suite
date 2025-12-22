-- Create hubspot_login_activity table
CREATE TABLE IF NOT EXISTS public.hubspot_login_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  user_email TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  login_type TEXT,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.hubspot_login_activity ENABLE ROW LEVEL SECURITY;

-- Create policy for read access
DROP POLICY IF EXISTS "Allow public read access" ON public.hubspot_login_activity;
CREATE POLICY "Allow public read access" ON public.hubspot_login_activity
  FOR SELECT USING (true);

-- Create policy for insert access (for the edge function)
DROP POLICY IF EXISTS "Allow public insert access" ON public.hubspot_login_activity;
CREATE POLICY "Allow public insert access" ON public.hubspot_login_activity
  FOR INSERT WITH CHECK (true);
