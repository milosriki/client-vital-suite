-- Test file for view_attribution_coverage
-- Purpose: Validates the attribution coverage view that answers
--          "How much of our pipeline has ad tracking?" by lifecycle_stage

-- Test 1: View exists and is queryable
DO $$
BEGIN
    PERFORM 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'view_attribution_coverage';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'view_attribution_coverage does not exist';
    END IF;

    RAISE NOTICE '✓ Test 1: View exists';
END $$;

-- Test 2: All expected columns are present
DO $$
DECLARE
    expected_columns TEXT[] := ARRAY[
        'lifecycle_stage',
        'total_contacts',
        'attributed_contacts',
        'attribution_pct',
        'with_ad_id',
        'with_campaign_id',
        'with_fb_ad_id',
        'with_utm_source',
        'with_attribution_source',
        'with_full_ad_attribution'
    ];
    col         TEXT;
    found_col   BOOLEAN;
BEGIN
    FOREACH col IN ARRAY expected_columns
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'view_attribution_coverage'
              AND column_name  = col
        ) INTO found_col;

        IF NOT found_col THEN
            RAISE EXCEPTION 'Missing column in view_attribution_coverage: %', col;
        END IF;
    END LOOP;

    RAISE NOTICE '✓ Test 2: All required columns present';
END $$;

-- Test 3: View is queryable and returns correct column types
SELECT
    pg_typeof(lifecycle_stage)            AS lifecycle_stage_type,
    pg_typeof(total_contacts)             AS total_contacts_type,
    pg_typeof(attributed_contacts)        AS attributed_contacts_type,
    pg_typeof(attribution_pct)            AS attribution_pct_type,
    pg_typeof(with_ad_id)                 AS with_ad_id_type,
    pg_typeof(with_full_ad_attribution)   AS with_full_ad_type
FROM public.view_attribution_coverage
LIMIT 0;

-- Test 4: attribution_pct is between 0 and 100 (or NULL for empty stages)
DO $$
DECLARE
    bad_pct_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO bad_pct_count
    FROM public.view_attribution_coverage
    WHERE attribution_pct < 0 OR attribution_pct > 100;

    IF bad_pct_count > 0 THEN
        RAISE EXCEPTION 'view_attribution_coverage: % rows have attribution_pct out of [0,100]', bad_pct_count;
    END IF;

    RAISE NOTICE '✓ Test 4: attribution_pct in valid range [0,100]';
END $$;

-- Test 5: attributed_contacts never exceeds total_contacts
DO $$
DECLARE
    overflow_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO overflow_count
    FROM public.view_attribution_coverage
    WHERE attributed_contacts > total_contacts;

    IF overflow_count > 0 THEN
        RAISE EXCEPTION 'view_attribution_coverage: % stages where attributed > total', overflow_count;
    END IF;

    RAISE NOTICE '✓ Test 5: attributed_contacts <= total_contacts for all stages';
END $$;

-- Test 6: Granular signal columns do not exceed total_contacts
DO $$
DECLARE
    overflow_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO overflow_count
    FROM public.view_attribution_coverage
    WHERE with_ad_id              > total_contacts
       OR with_campaign_id        > total_contacts
       OR with_fb_ad_id           > total_contacts
       OR with_utm_source         > total_contacts
       OR with_attribution_source > total_contacts
       OR with_full_ad_attribution > total_contacts;

    IF overflow_count > 0 THEN
        RAISE EXCEPTION 'view_attribution_coverage: % stages have signal columns exceeding total_contacts', overflow_count;
    END IF;

    RAISE NOTICE '✓ Test 6: All signal columns <= total_contacts';
END $$;

-- Test 7: with_full_ad_attribution <= with_ad_id (subset constraint)
DO $$
DECLARE
    violation_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO violation_count
    FROM public.view_attribution_coverage
    WHERE with_full_ad_attribution > with_ad_id;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'view_attribution_coverage: % stages where full_ad_attribution > with_ad_id (impossible)', violation_count;
    END IF;

    RAISE NOTICE '✓ Test 7: with_full_ad_attribution <= with_ad_id for all stages';
END $$;

-- Test 8: No duplicate lifecycle_stage rows
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) - COUNT(DISTINCT lifecycle_stage)
    INTO dup_count
    FROM public.view_attribution_coverage;

    IF dup_count > 0 THEN
        RAISE EXCEPTION 'view_attribution_coverage: % duplicate lifecycle_stage rows', dup_count;
    END IF;

    RAISE NOTICE '✓ Test 8: No duplicate lifecycle_stage rows';
END $$;

-- Test 9: Coverage summary — data quality overview
SELECT
    'view_attribution_coverage'                         AS view_name,
    SUM(total_contacts)                                 AS total_contacts,
    SUM(attributed_contacts)                            AS attributed_contacts,
    ROUND(
        SUM(attributed_contacts) * 100.0
        / NULLIF(SUM(total_contacts), 0),
        1
    )                                                   AS overall_attribution_pct,
    COUNT(*)                                            AS stage_count,
    MIN(attribution_pct)                                AS min_stage_pct,
    MAX(attribution_pct)                                AS max_stage_pct
FROM public.view_attribution_coverage;

-- Test 10: Per-stage breakdown for visual inspection
SELECT
    lifecycle_stage,
    total_contacts,
    attributed_contacts,
    attribution_pct          AS pct,
    with_ad_id,
    with_campaign_id,
    with_utm_source,
    with_full_ad_attribution
FROM public.view_attribution_coverage
ORDER BY attribution_pct DESC NULLS LAST;
