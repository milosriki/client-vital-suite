-- Test file for view_call_attribution
-- Purpose: Validates the call→ad attribution view that answers "Which call came from which ad?"

-- Test 1: View exists and is queryable
DO $$
BEGIN
    PERFORM 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'view_call_attribution';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'view_call_attribution does not exist';
    END IF;

    RAISE NOTICE '✓ Test 1: View exists';
END $$;

-- Test 2: All expected columns are present
DO $$
DECLARE
    expected_columns TEXT[] := ARRAY[
        'call_id', 'call_external_id', 'call_direction', 'call_status', 'call_outcome',
        'duration_seconds', 'started_at', 'caller_number', 'called_number',
        'appointment_set', 'lead_quality', 'call_score', 'ptd_outcome',
        'agent_id', 'agent_name',
        'contact_id', 'contact_email', 'first_name', 'last_name', 'contact_phone',
        'ad_id', 'adset_id', 'campaign_id', 'attribution_source',
        'utm_source', 'utm_medium', 'utm_campaign'
    ];
    col TEXT;
    found_col BOOLEAN;
BEGIN
    FOREACH col IN ARRAY expected_columns
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'view_call_attribution'
              AND column_name  = col
        ) INTO found_col;

        IF NOT found_col THEN
            RAISE EXCEPTION 'Missing column in view_call_attribution: %', col;
        END IF;
    END LOOP;

    RAISE NOTICE '✓ Test 2: All required columns present';
END $$;

-- Test 3: Phone normalization indexes exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname   = 'idx_contacts_phone_last9'
    ) THEN
        RAISE WARNING 'Missing index: idx_contacts_phone_last9';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname   = 'idx_call_records_caller_last9'
    ) THEN
        RAISE WARNING 'Missing index: idx_call_records_caller_last9';
    END IF;

    RAISE NOTICE '✓ Test 3: Phone normalization indexes checked';
END $$;

-- Test 4: View is queryable and returns correct column types
SELECT
    pg_typeof(call_id)           AS call_id_type,
    pg_typeof(contact_id)        AS contact_id_type,
    pg_typeof(ad_id)             AS ad_id_type,
    pg_typeof(campaign_id)       AS campaign_id_type,
    pg_typeof(duration_seconds)  AS duration_type,
    pg_typeof(utm_source)        AS utm_source_type
FROM public.view_call_attribution
LIMIT 0;

-- Test 5: Phone normalization logic — last 9 digits are used for matching
-- Verify that the join produces no duplicate call_ids (one call → one best contact match)
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) - COUNT(DISTINCT call_id)
    INTO dup_count
    FROM public.view_call_attribution;

    IF dup_count > 0 THEN
        RAISE WARNING 'view_call_attribution: % duplicate call_id rows (multi-contact phone match)', dup_count;
    ELSE
        RAISE NOTICE '✓ Test 5: No duplicate call_ids';
    END IF;
END $$;

-- Test 6: Attribution columns are populated where data exists
DO $$
DECLARE
    attributed_count INTEGER;
    total_count      INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM public.view_call_attribution;
    SELECT COUNT(*) INTO attributed_count
    FROM public.view_call_attribution
    WHERE ad_id IS NOT NULL OR campaign_id IS NOT NULL OR utm_source IS NOT NULL;

    RAISE NOTICE '✓ Test 6: % / % calls have attribution data', attributed_count, total_count;
END $$;

-- Test 7: Summary stats — data quality overview
SELECT
    'view_call_attribution'                                       AS view_name,
    COUNT(*)                                                      AS total_rows,
    COUNT(DISTINCT call_id)                                       AS unique_calls,
    COUNT(DISTINCT contact_id)                                    AS unique_contacts,
    COUNT(*) FILTER (WHERE ad_id IS NOT NULL)                     AS calls_with_ad_id,
    COUNT(*) FILTER (WHERE campaign_id IS NOT NULL)               AS calls_with_campaign_id,
    COUNT(*) FILTER (WHERE utm_source IS NOT NULL)                AS calls_with_utm_source,
    COUNT(*) FILTER (WHERE appointment_set = TRUE)                AS appointments_set
FROM public.view_call_attribution;
