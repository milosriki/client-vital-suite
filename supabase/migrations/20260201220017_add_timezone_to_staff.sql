-- Add timezone column to staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Dubai';

-- Update existing staff to have Dubai timezone
UPDATE public.staff SET timezone = 'Asia/Dubai' WHERE timezone IS NULL;

-- Also update metadata jsonb to include timezone if missing
UPDATE public.staff 
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{timezone}', '"Asia/Dubai"')
WHERE metadata->>'timezone' IS NULL OR metadata->>'timezone' != 'Asia/Dubai';

-- Add comment
COMMENT ON COLUMN public.staff.timezone IS 'User preferred timezone (defaults to Asia/Dubai)';
