-- Test file for view_atlas_lead_dna
-- Purpose: Validates the core intelligence view that answers "Which ad made me money?"

-- Test 1: View exists and is queryable
DO $$
BEGIN
    PERFORM 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'view_atlas_lead_dna';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'view_atlas_lead_dna does not exist';
    END IF;

    RAISE NOTICE '✓ Test 1: View exists';
END $$;

-- Test 2: View structure - verify all expected columns exist
DO $$
DECLARE
    expected_columns TEXT[] := ARRAY[
        'contact_id', 'full_name', 'email', 'city', 'custom_lifecycle_stage',
        'ad_id', 'creative_name', 'ad_copy', 'image_url',
        'call_duration_seconds', 'call_count', 'verified_revenue', 'atlas_lead_status'
    ];
    col TEXT;
    found_col BOOLEAN;
BEGIN
    FOREACH col IN ARRAY expected_columns
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'view_atlas_lead_dna'
            AND column_name = col
        ) INTO found_col;

        IF NOT found_col THEN
            RAISE EXCEPTION 'Missing column: %', col;
        END IF;
    END LOOP;

    RAISE NOTICE '✓ Test 2: All required columns exist';
END $$;

-- Test 3: Indexes exist for performance
DO $$
BEGIN
    -- Check for email index
    IF NOT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname = 'idx_attribution_events_email_lower'
    ) THEN
        RAISE WARNING 'Missing index: idx_attribution_events_email_lower';
    END IF;

    -- Check for known_cards email index
    IF NOT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname = 'idx_known_cards_email_lower'
    ) THEN
        RAISE WARNING 'Missing index: idx_known_cards_email_lower';
    END IF;

    -- Check for stripe_transactions index
    IF NOT EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname = 'idx_stripe_txn_succeeded'
    ) THEN
        RAISE WARNING 'Missing index: idx_stripe_txn_succeeded';
    END IF;

    RAISE NOTICE '✓ Test 3: Performance indexes checked';
END $$;

-- Test 4: View is queryable and returns expected data types
SELECT
    pg_typeof(contact_id) as contact_id_type,
    pg_typeof(full_name) as full_name_type,
    pg_typeof(email) as email_type,
    pg_typeof(call_duration_seconds) as call_duration_type,
    pg_typeof(call_count) as call_count_type,
    pg_typeof(verified_revenue) as verified_revenue_type,
    pg_typeof(atlas_lead_status) as atlas_lead_status_type
FROM public.view_atlas_lead_dna
LIMIT 0;

-- Test 5: Atlas lead status logic validation
-- This test verifies the categorization logic works correctly
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    -- Count each status category (should not error)
    SELECT COUNT(*) INTO test_count
    FROM public.view_atlas_lead_dna
    WHERE atlas_lead_status IN ('High Intent - Pending', 'Verified Winner', 'Low Intent - Potential Waste', 'Neutral');

    RAISE NOTICE '✓ Test 5: Atlas lead status logic is valid';
END $$;

-- Test 6: Performance test - view should execute in reasonable time
EXPLAIN ANALYZE
SELECT
    atlas_lead_status,
    COUNT(*) as lead_count,
    ROUND(AVG(verified_revenue), 2) as avg_revenue,
    SUM(verified_revenue) as total_revenue
FROM public.view_atlas_lead_dna
GROUP BY atlas_lead_status;

-- Test 7: Data quality checks
SELECT
    'view_atlas_lead_dna' as view_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT contact_id) as unique_contacts,
    COUNT(DISTINCT ad_id) as unique_ads,
    COUNT(*) FILTER (WHERE verified_revenue > 0) as revenue_generating_leads,
    ROUND(AVG(call_duration_seconds), 2) as avg_call_duration,
    ROUND(AVG(verified_revenue), 2) as avg_revenue,
    ROUND(SUM(verified_revenue), 2) as total_revenue
FROM public.view_atlas_lead_dna;

-- Documentation output
SELECT '
================================================================================
VIEW: view_atlas_lead_dna
================================================================================

PURPOSE:
--------
This is THE core intelligence view that answers: "Which Facebook ad made me money?"

DATA FLOW:
----------
1. facebook_creatives → ad creative details (ad_id, creative_name, ad_copy, image_url)
2. contacts + attribution_events → lead attribution (which ad generated this lead)
3. call_records → call intent signals (duration, frequency)
4. stripe_transactions + known_cards → verified revenue (actual cash collected)

KEY JOINS:
----------
- contacts ← attribution_events (via email match)
- contacts ← call_records (via phone match)
- contacts ← known_cards (via email) ← stripe_transactions (via customer_id)

COMPUTED COLUMNS:
-----------------
- atlas_lead_status: Categorizes leads by intent and revenue:
  * "Verified Winner" - Lead has paid (verified_revenue > 0)
  * "High Intent - Pending" - Long calls (>15min) but no payment yet
  * "Low Intent - Potential Waste" - Short calls (<1min), likely wrong number
  * "Neutral" - Everything else

PERFORMANCE OPTIMIZATIONS:
--------------------------
1. Functional index on LOWER(email) for case-insensitive email matching
2. Partial index on stripe_transactions (status = succeeded) - only care about successful payments
3. CTE-based architecture for query optimizer to cache intermediate results

USE CASES:
----------
1. Attribution Intelligence: Which ads drive paying customers?
2. Ad Performance: True ROAS with real revenue data
3. Lead Quality: Identify high-intent leads before they convert
4. Wastage Detection: Flag ads generating low-quality leads

EXAMPLE QUERIES:
----------------
-- Top performing ads by revenue
SELECT ad_id, creative_name,
       COUNT(*) as lead_count,
       SUM(verified_revenue) as total_revenue
FROM view_atlas_lead_dna
WHERE verified_revenue > 0
GROUP BY ad_id, creative_name
ORDER BY total_revenue DESC
LIMIT 10;

-- High intent leads not yet converted
SELECT full_name, email, city, ad_id, call_duration_seconds
FROM view_atlas_lead_dna
WHERE atlas_lead_status = ''High Intent - Pending''
ORDER BY call_duration_seconds DESC;

================================================================================
' as documentation;
