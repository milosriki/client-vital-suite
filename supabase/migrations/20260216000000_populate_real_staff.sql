-- Populate staff table with real coaches and setters/closers
-- Valid roles per DB constraint: setter, closer, both
-- Source: contacts.assigned_coach (31 coaches) + deals.owner_name (8 deal owners) + contacts.owner_name (22 contact owners)

-- Step 1: Update constraint to include 'coach' role
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check CHECK (role IN ('setter', 'closer', 'both', 'coach'));

-- Step 2: Clear fake seed data
DELETE FROM staff WHERE email LIKE '%@fitness.com' OR name IN ('John Smith', 'Sarah Johnson', 'Mike Wilson', 'Lisa Brown', 'David Jones');

-- Step 3: Insert real coaches from contacts.assigned_coach
INSERT INTO staff (id, name, email, role, status, home_zone, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  assigned_coach,
  lower(replace(replace(assigned_coach, ' ', '.'), '-', '.')) || '@ptdfitness.com',
  'coach',
  'active',
  'Dubai',
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT assigned_coach 
  FROM contacts 
  WHERE assigned_coach IS NOT NULL 
    AND TRIM(assigned_coach) != ''
) coaches
WHERE NOT EXISTS (
  SELECT 1 FROM staff WHERE staff.name = coaches.assigned_coach
)
ON CONFLICT DO NOTHING;

-- Step 4: Insert deal owners as setters/closers
INSERT INTO staff (id, name, email, role, status, home_zone, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  owner_name,
  lower(replace(replace(owner_name, ' ', '.'), '-', '.')) || '@ptdfitness.com',
  'setter',
  'active',
  'Dubai',
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT owner_name 
  FROM deals 
  WHERE owner_name IS NOT NULL 
    AND TRIM(owner_name) != ''
) deal_owners
WHERE NOT EXISTS (
  SELECT 1 FROM staff WHERE staff.name = deal_owners.owner_name
)
ON CONFLICT DO NOTHING;

-- Step 5: Insert contact owners who aren't already in staff
INSERT INTO staff (id, name, email, role, status, home_zone, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  owner_name,
  lower(replace(replace(owner_name, ' ', '.'), '-', '.')) || '@ptdfitness.com',
  'setter',
  'active',
  'Dubai',
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT owner_name 
  FROM contacts 
  WHERE owner_name IS NOT NULL 
    AND TRIM(owner_name) != ''
    AND owner_name NOT IN ('Tracking Webdeanalytics', 'Philips Ad', ' ')
) contact_owners
WHERE NOT EXISTS (
  SELECT 1 FROM staff WHERE staff.name = contact_owners.owner_name
)
ON CONFLICT DO NOTHING;
