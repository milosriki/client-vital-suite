-- Task 4.5: Seed currency rates in org_memory_kv
-- These can be updated via the dashboard or a scheduled function
-- stripe-dashboard-data/index.ts reads from here instead of hardcoded values

INSERT INTO org_memory_kv (namespace, key, value, source, expires_at)
VALUES (
    'config',
    'currency_rates_aed',
    '{"usd": 3.67, "eur": 4.00, "gbp": 4.65, "sar": 0.98, "jpy": 0.025, "cad": 2.70, "aud": 2.40, "chf": 4.15, "inr": 0.044}'::jsonb,
    'migration_seed',
    NOW() + INTERVAL '365 days'
)
ON CONFLICT (namespace, key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW(),
    expires_at = EXCLUDED.expires_at;
