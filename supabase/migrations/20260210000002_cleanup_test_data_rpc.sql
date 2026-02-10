-- RPC function to safely cleanup test data
-- This function identifies and removes records matching fake data patterns

CREATE OR REPLACE FUNCTION public.cleanup_test_data(dry_run BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_contacts_count INTEGER := 0;
    deleted_leads_count INTEGER := 0;
    deleted_deals_count INTEGER := 0;
    deleted_health_scores_count INTEGER := 0;
    result JSONB;
    fake_email_patterns TEXT[] := ARRAY[
        '%@example.com', '%@email.com', '%@test.com', '%@fake.com', 
        '%@dummy.com', '%@sample.com', '%@testing.com', '%@localhost%',
        'test%@%', 'fake%@%', 'dummy%@%', 'sample%@%', 'noreply%@%', 'no-reply%@%'
    ];
    fake_name_patterns TEXT[] := ARRAY[
        'test%', 'fake%', 'dummy%', 'sample%', 'john doe', 'jane doe'
    ];
BEGIN
    -- 1. CLEANUP CONTACTS
    IF dry_run THEN
        SELECT count(*) INTO deleted_contacts_count FROM public.contacts 
        WHERE email ILIKE ANY(fake_email_patterns) 
           OR first_name ILIKE ANY(fake_name_patterns)
           OR last_name ILIKE ANY(fake_name_patterns);
    ELSE
        WITH deleted AS (
            DELETE FROM public.contacts 
            WHERE email ILIKE ANY(fake_email_patterns) 
               OR first_name ILIKE ANY(fake_name_patterns)
               OR last_name ILIKE ANY(fake_name_patterns)
            RETURNING id
        )
        SELECT count(*) INTO deleted_contacts_count FROM deleted;
    END IF;

    -- 2. CLEANUP LEADS
    IF dry_run THEN
        SELECT count(*) INTO deleted_leads_count FROM public.leads 
        WHERE email ILIKE ANY(fake_email_patterns) 
           OR name ILIKE ANY(fake_name_patterns);
    ELSE
        WITH deleted AS (
            DELETE FROM public.leads 
            WHERE email ILIKE ANY(fake_email_patterns) 
               OR name ILIKE ANY(fake_name_patterns)
            RETURNING id
        )
        SELECT count(*) INTO deleted_leads_count FROM deleted;
    END IF;

    -- 3. CLEANUP DEALS
    IF dry_run THEN
        SELECT count(*) INTO deleted_deals_count FROM public.deals 
        WHERE deal_name ILIKE '%test%' 
           OR deal_name ILIKE '%fake%'
           OR hubspot_deal_id IS NULL;
    ELSE
        WITH deleted AS (
            DELETE FROM public.deals 
            WHERE deal_name ILIKE '%test%' 
               OR deal_name ILIKE '%fake%'
               OR hubspot_deal_id IS NULL
            RETURNING id
        )
        SELECT count(*) INTO deleted_deals_count FROM deleted;
    END IF;

    -- 4. CLEANUP HEALTH SCORES
    IF dry_run THEN
        SELECT count(*) INTO deleted_health_scores_count FROM public.client_health_scores 
        WHERE email ILIKE ANY(fake_email_patterns);
    ELSE
        WITH deleted AS (
            DELETE FROM public.client_health_scores 
            WHERE email ILIKE ANY(fake_email_patterns)
            RETURNING email
        )
        SELECT count(*) INTO deleted_health_scores_count FROM deleted;
    END IF;

    -- Construct result
    result := jsonb_build_object(
        'dry_run', dry_run,
        'deleted_counts', jsonb_build_object(
            'contacts', deleted_contacts_count,
            'leads', deleted_leads_count,
            'deals', deleted_deals_count,
            'health_scores', deleted_health_scores_count
        ),
        'timestamp', now()
    );

    -- Log operation if not a dry run
    IF NOT dry_run AND (deleted_contacts_count + deleted_leads_count + deleted_deals_count + deleted_health_scores_count) > 0 THEN
        INSERT INTO public.sync_logs (platform, sync_type, status, records_processed, message)
        VALUES ('cleanup', 'rpc_cleanup', 'completed', 
                (deleted_contacts_count + deleted_leads_count + deleted_deals_count + deleted_health_scores_count),
                result::text);
    END IF;

    RETURN result;
END;
$$;
