-- Create the base table for the new lightweight sync
CREATE TABLE IF NOT EXISTS sales_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_id TEXT UNIQUE NOT NULL,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    company TEXT,
    status TEXT, -- The normalized "Smart Status"
    raw_status TEXT, -- The original HubSpot status
    call_status TEXT, -- Specifically for the Hitesh Mistry fix
    hubspot_owner_id TEXT,
    lifecycle_stage TEXT,
    last_contacted TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales_leads' 
        AND policyname = 'Allow authenticated read access'
    ) THEN
        CREATE POLICY "Allow authenticated read access" ON sales_leads
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Policy: Allow service role to full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sales_leads' 
        AND policyname = 'Allow service role full access'
    ) THEN
        CREATE POLICY "Allow service role full access" ON sales_leads
            FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- VIEW 1: Sales Contacts (Active Leads)
-- Filters out customers, focuses on people the sales team needs to work
CREATE OR REPLACE VIEW vw_sales_contacts AS
SELECT 
    id,
    hubspot_id,
    first_name,
    last_name,
    email,
    phone,
    company,
    status,
    last_contacted,
    hubspot_owner_id
FROM sales_leads
WHERE lifecycle_stage != 'customer'
  AND status != 'DISQUALIFIED'
ORDER BY last_contacted DESC NULLS LAST;

-- VIEW 2: Active Clients (Management View)
-- Shows only converted customers
CREATE OR REPLACE VIEW vw_active_clients AS
SELECT 
    id,
    hubspot_id,
    first_name,
    last_name,
    company,
    email,
    phone,
    updated_at as last_sync
FROM sales_leads
WHERE lifecycle_stage = 'customer';
