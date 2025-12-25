-- ============================================
-- FIX INTERVENTION_LOG UNIQUE CONSTRAINT
-- Required for upsert operations to work correctly
-- ============================================

-- First, remove any duplicate client_email entries (keep the most recent one)
-- This is needed before we can add a unique constraint
WITH duplicates AS (
  SELECT id, client_email,
    ROW_NUMBER() OVER (PARTITION BY client_email ORDER BY created_at DESC) as rn
  FROM intervention_log
  WHERE client_email IS NOT NULL
)
DELETE FROM intervention_log
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Add unique constraint on client_email
-- This allows upsert operations with onConflict: "client_email"
ALTER TABLE intervention_log
ADD CONSTRAINT intervention_log_client_email_unique UNIQUE (client_email);

-- Create index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_intervention_log_client_email 
ON intervention_log(client_email);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'intervention_log_client_email_unique'
  ) THEN
    RAISE NOTICE 'SUCCESS: intervention_log_client_email_unique constraint created';
  ELSE
    RAISE WARNING 'FAILED: unique constraint not created';
  END IF;
END $$;
