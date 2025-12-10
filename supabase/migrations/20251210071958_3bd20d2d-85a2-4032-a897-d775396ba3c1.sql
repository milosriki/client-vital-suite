-- Fix: Replace functional DATE() index with a generated column (IMMUTABLE)

-- 1) Add a generated column that normalizes calculated_at to a date (UTC safe)
ALTER TABLE client_health_scores
  ADD COLUMN IF NOT EXISTS calculated_date date GENERATED ALWAYS AS ((calculated_at AT TIME ZONE 'UTC')::date) STORED;

-- 2) Drop the problematic index if it exists
DROP INDEX IF EXISTS idx_health_scores_email_date;

-- 3) Create a unique index on email + generated date
CREATE UNIQUE INDEX idx_health_scores_email_date
  ON client_health_scores(email, calculated_date);