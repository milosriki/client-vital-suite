-- Add coach segmentation columns needed by view_coach_capacity_load
-- Rule 4.1: Use text (not varchar) for variable-length strings
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS home_zone text DEFAULT 'Dubai';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS gender text;

-- Rule 1.5: Partial index — only active coaches are queried
CREATE INDEX IF NOT EXISTS idx_staff_active_coaches
  ON public.staff (name, home_zone, gender)
  WHERE role = 'coach' AND status = 'active';

-- Rule 1.3: Composite index matching the capacity view's GROUP BY
CREATE INDEX IF NOT EXISTS idx_staff_zone_gender
  ON public.staff (home_zone, gender)
  WHERE role = 'coach' AND status = 'active';
