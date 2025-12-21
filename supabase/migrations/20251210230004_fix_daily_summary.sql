-- Add primary key if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_summary_pkey') THEN
    ALTER TABLE daily_summary ADD PRIMARY KEY (summary_date);
  END IF;
END $$;

-- Add check constraint for utilization
ALTER TABLE daily_summary DROP CONSTRAINT IF EXISTS valid_utilization;
ALTER TABLE daily_summary ADD CONSTRAINT valid_utilization 
  CHECK (max_utilization_rate >= 0 AND max_utilization_rate <= 100);
