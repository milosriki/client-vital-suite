
-- Secure RLS Migration
-- 1. Enable RLS on all public tables
-- 2. Add 'Service Role Full Access' policy to all tables to ensure backend continuity

DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP 
        -- 1. Enable RLS
        EXECUTE 'ALTER TABLE public."' || r.tablename || '" ENABLE ROW LEVEL SECURITY;'; 
        
        -- 2. Create Service Role Policy (if not exists)
        -- We check pg_policies first to avoid duplicate errors, or use IF NOT EXISTS syntax (Postgres 9.5+)
        -- But CREATE POLICY IF NOT EXISTS is only available in newer Postgres (10+? Supabase is 15).
        -- Supabase Postgres 15 supports CREATE POLICY IF NOT EXISTS.
        
        BEGIN
            EXECUTE 'CREATE POLICY "Service Role Full Access" ON public."' || r.tablename || '" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);';
        EXCEPTION WHEN duplicate_object THEN
            -- Policy already exists, ignore
            NULL;
        END;
        
    END LOOP; 
END $$;
