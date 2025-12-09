-- PTD Fitness Database Verification Script
-- Task 16: Verify all database objects are properly created
-- ============================================================

\set QUIET on
\pset pager off

-- Start verification
\echo ''
\echo '========================================'
\echo 'PTD FITNESS DATABASE VERIFICATION'
\echo '========================================'
\echo ''

-- ============================================================
-- SECTION 1: TABLE EXISTENCE CHECKS
-- ============================================================

\echo '----------------------------------------'
\echo 'CHECKING TABLE EXISTENCE'
\echo '----------------------------------------'
\echo ''

-- Check sync_logs table
\echo '1. Checking table: sync_logs'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'sync_logs'
        )
        THEN '   ✓ PASS - Table sync_logs exists'
        ELSE '   ✗ FAIL - Table sync_logs NOT FOUND'
    END AS result;

-- Check sync_queue table
\echo ''
\echo '2. Checking table: sync_queue'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'sync_queue'
        )
        THEN '   ✓ PASS - Table sync_queue exists'
        ELSE '   ✗ FAIL - Table sync_queue NOT FOUND'
    END AS result;

-- Check system_settings table
\echo ''
\echo '3. Checking table: system_settings'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'system_settings'
        )
        THEN '   ✓ PASS - Table system_settings exists'
        ELSE '   ✗ FAIL - Table system_settings NOT FOUND'
    END AS result;

-- Check leads table
\echo ''
\echo '4. Checking table: leads'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'leads'
        )
        THEN '   ✓ PASS - Table leads exists'
        ELSE '   ✗ FAIL - Table leads NOT FOUND'
    END AS result;

-- Check leads.ai_suggested_reply column
\echo ''
\echo '5. Checking column: leads.ai_suggested_reply'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'leads'
            AND column_name = 'ai_suggested_reply'
        )
        THEN '   ✓ PASS - Column leads.ai_suggested_reply exists'
        ELSE '   ✗ FAIL - Column leads.ai_suggested_reply NOT FOUND'
    END AS result;

-- Check daily_summary table
\echo ''
\echo '6. Checking table: daily_summary'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'daily_summary'
        )
        THEN '   ✓ PASS - Table daily_summary exists'
        ELSE '   ✗ FAIL - Table daily_summary NOT FOUND'
    END AS result;

-- ============================================================
-- SECTION 2: INDEX EXISTENCE CHECKS
-- ============================================================

\echo ''
\echo '----------------------------------------'
\echo 'CHECKING INDEX EXISTENCE'
\echo '----------------------------------------'
\echo ''

-- Check idx_sync_logs_status index
\echo '7. Checking index: idx_sync_logs_status'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname = 'idx_sync_logs_status'
        )
        THEN '   ✓ PASS - Index idx_sync_logs_status exists'
        ELSE '   ✗ FAIL - Index idx_sync_logs_status NOT FOUND'
    END AS result;

-- Check idx_sync_logs_platform index
\echo ''
\echo '8. Checking index: idx_sync_logs_platform'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname = 'idx_sync_logs_platform'
        )
        THEN '   ✓ PASS - Index idx_sync_logs_platform exists'
        ELSE '   ✗ FAIL - Index idx_sync_logs_platform NOT FOUND'
    END AS result;

-- Check idx_sync_logs_started_at index
\echo ''
\echo '9. Checking index: idx_sync_logs_started_at'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname = 'idx_sync_logs_started_at'
        )
        THEN '   ✓ PASS - Index idx_sync_logs_started_at exists'
        ELSE '   ✗ FAIL - Index idx_sync_logs_started_at NOT FOUND'
    END AS result;

-- Check idx_sync_queue_status_next_attempt index
\echo ''
\echo '10. Checking index: idx_sync_queue_status_next_attempt'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname = 'idx_sync_queue_status_next_attempt'
        )
        THEN '   ✓ PASS - Index idx_sync_queue_status_next_attempt exists'
        ELSE '   ✗ FAIL - Index idx_sync_queue_status_next_attempt NOT FOUND'
    END AS result;

-- ============================================================
-- SECTION 3: FUNCTION EXISTENCE CHECKS
-- ============================================================

\echo ''
\echo '----------------------------------------'
\echo 'CHECKING FUNCTION EXISTENCE'
\echo '----------------------------------------'
\echo ''

-- Check cleanup_old_logs function
\echo '11. Checking function: cleanup_old_logs()'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name = 'cleanup_old_logs'
            AND routine_type = 'FUNCTION'
        )
        THEN '   ✓ PASS - Function cleanup_old_logs() exists'
        ELSE '   ✗ FAIL - Function cleanup_old_logs() NOT FOUND'
    END AS result;

-- ============================================================
-- SECTION 4: SUMMARY
-- ============================================================

\echo ''
\echo '========================================'
\echo 'VERIFICATION SUMMARY'
\echo '========================================'
\echo ''

-- Count passed and failed checks
WITH verification_results AS (
    SELECT
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'sync_logs'
        )) AS sync_logs_table,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'sync_queue'
        )) AS sync_queue_table,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'system_settings'
        )) AS system_settings_table,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'leads'
        )) AS leads_table,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'ai_suggested_reply'
        )) AS leads_ai_column,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'daily_summary'
        )) AS daily_summary_table,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'idx_sync_logs_status'
        )) AS idx_status,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'idx_sync_logs_platform'
        )) AS idx_platform,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'idx_sync_logs_started_at'
        )) AS idx_started_at,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'idx_sync_queue_status_next_attempt'
        )) AS idx_queue,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_name = 'cleanup_old_logs' AND routine_type = 'FUNCTION'
        )) AS cleanup_function
    FROM generate_series(1,1)
)
SELECT
    'Total Checks: 11' AS summary_line
UNION ALL
SELECT
    'Passed: ' || (
        sync_logs_table + sync_queue_table + system_settings_table +
        leads_table + leads_ai_column + daily_summary_table +
        idx_status + idx_platform + idx_started_at + idx_queue + cleanup_function
    )::text
FROM verification_results
UNION ALL
SELECT
    'Failed: ' || (
        11 - (
            sync_logs_table + sync_queue_table + system_settings_table +
            leads_table + leads_ai_column + daily_summary_table +
            idx_status + idx_platform + idx_started_at + idx_queue + cleanup_function
        )
    )::text
FROM verification_results;

\echo ''
\echo '========================================'
\echo 'END OF VERIFICATION'
\echo '========================================'
\echo ''

-- Additional detailed information (optional)
\echo ''
\echo '----------------------------------------'
\echo 'DETAILED DATABASE OBJECT INFORMATION'
\echo '----------------------------------------'
\echo ''

\echo 'Tables in public schema:'
SELECT
    table_name,
    CASE
        WHEN table_name IN ('sync_logs', 'sync_queue', 'system_settings', 'leads', 'daily_summary')
        THEN '✓ Required'
        ELSE '  Other'
    END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY
    CASE WHEN table_name IN ('sync_logs', 'sync_queue', 'system_settings', 'leads', 'daily_summary') THEN 0 ELSE 1 END,
    table_name;

\echo ''
\echo 'Indexes in public schema:'
SELECT
    indexname,
    tablename,
    CASE
        WHEN indexname IN (
            'idx_sync_logs_status',
            'idx_sync_logs_platform',
            'idx_sync_logs_started_at',
            'idx_sync_queue_status_next_attempt'
        )
        THEN '✓ Required'
        ELSE '  Other'
    END AS status
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY
    CASE WHEN indexname IN (
        'idx_sync_logs_status',
        'idx_sync_logs_platform',
        'idx_sync_logs_started_at',
        'idx_sync_queue_status_next_attempt'
    ) THEN 0 ELSE 1 END,
    indexname;

\echo ''
\echo 'Functions in public schema:'
SELECT
    routine_name,
    routine_type,
    CASE
        WHEN routine_name = 'cleanup_old_logs'
        THEN '✓ Required'
        ELSE '  Other'
    END AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY
    CASE WHEN routine_name = 'cleanup_old_logs' THEN 0 ELSE 1 END,
    routine_name;

\echo ''
