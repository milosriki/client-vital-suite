-- Refine staff and contacts relationship
-- 1. Ensure staff table has correct role constraint
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'manager', 'supervisor', 'agent', 'setter', 'coach'));

-- 2. Add AWS-specific IDs to staff
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'aws_coach_id') THEN
    ALTER TABLE public.staff ADD COLUMN aws_coach_id TEXT;
END IF;

-- 3. Add Setter and Coach UUID links to contacts
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'setter_uuid') THEN
    ALTER TABLE public.contacts ADD COLUMN setter_uuid UUID REFERENCES public.staff(id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'coach_uuid') THEN
    ALTER TABLE public.contacts ADD COLUMN coach_uuid UUID REFERENCES public.staff(id);
END IF;

-- 4. Create indexes for the new links
CREATE INDEX IF NOT EXISTS idx_contacts_setter_uuid ON public.contacts(setter_uuid);
CREATE INDEX IF NOT EXISTS idx_contacts_coach_uuid ON public.contacts(coach_uuid);

-- 5. Seed some AWS IDs if known (based on common patterns)
-- These would be populated by the aws-backoffice-sync function
UPDATE public.staff SET aws_coach_id = 'AWS_MATTHEW' WHERE full_name = 'Matthew Twigg';
