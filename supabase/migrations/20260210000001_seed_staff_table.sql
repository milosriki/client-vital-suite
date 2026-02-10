CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'supervisor', 'agent', 'setter', 'coach')),
    department TEXT,
    team TEXT,
    hubspot_owner_id TEXT,
    callgear_employee_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed staff table with valid coaches and setters
-- Values based on research and existing CRM ownership

INSERT INTO public.staff (full_name, hubspot_owner_id, role, status, is_active)
VALUES 
    ('Matthew Twigg', '452974662', 'setter', 'active', true),
    ('Yehia Salah', '171', 'setter', 'active', true),
    ('Milos Vukovic', '165', 'admin', 'active', true),
    ('Nevena Antonijevic', '149', 'coach', 'active', true),
    ('Amin Sejfic', '83', 'coach', 'active', true),
    ('Filip Tomic', '48', 'coach', 'active', true),
    ('Tea Vukovic', '43', 'coach', 'active', true),
    ('Nemanja', 'nemanja_id', 'coach', 'active', true),
    ('Danni', 'danni_id', 'coach', 'active', true),
    ('Jovana Jezdimirovic', 'jovana_id', 'coach', 'active', true),
    ('Shohre', 'shohre_id', 'coach', 'active', true),
    ('Vukasin Dizdar', 'vukasin_id', 'coach', 'active', true),
    ('Daniel Herbert', 'daniel_id', 'coach', 'active', true),
    ('Marina', 'marina_id', 'coach', 'active', true),
    ('Natasa Arsenijevic', 'natasa_id', 'coach', 'active', true),
    ('Unassigned / Admin', 'unassigned', 'admin', 'active', true)
ON CONFLICT (email) DO UPDATE SET
    hubspot_owner_id = EXCLUDED.hubspot_owner_id,
    full_name = EXCLUDED.full_name,
    is_active = EXCLUDED.is_active;

-- Update emails for known staff (using placeholder emails since they are unique)
-- In a real scenario, these would be their professional emails
UPDATE public.staff SET email = 'matthew.twigg@ptdubai.ae' WHERE full_name = 'Matthew Twigg';
UPDATE public.staff SET email = 'yehia.salah@ptdubai.ae' WHERE full_name = 'Yehia Salah';
UPDATE public.staff SET email = 'milos.vukovic@ptdubai.ae' WHERE full_name = 'Milos Vukovic';
UPDATE public.staff SET email = 'nevena.antonijevic@ptdubai.ae' WHERE full_name = 'Nevena Antonijevic';
UPDATE public.staff SET email = 'amin.sejfic@ptdubai.ae' WHERE full_name = 'Amin Sejfic';
UPDATE public.staff SET email = 'filip.tomic@ptdubai.ae' WHERE full_name = 'Filip Tomic';
UPDATE public.staff SET email = 'tea.vukovic@ptdubai.ae' WHERE full_name = 'Tea Vukovic';
UPDATE public.staff SET email = 'nemanja@ptdubai.ae' WHERE full_name = 'Nemanja';
UPDATE public.staff SET email = 'danni@ptdubai.ae' WHERE full_name = 'Danni';
UPDATE public.staff SET email = 'jovana.jezdimirovic@ptdubai.ae' WHERE full_name = 'Jovana Jezdimirovic';
UPDATE public.staff SET email = 'shohre@ptdubai.ae' WHERE full_name = 'Shohre';
UPDATE public.staff SET email = 'vukasin.dizdar@ptdubai.ae' WHERE full_name = 'Vukasin Dizdar';
UPDATE public.staff SET email = 'daniel.herbert@ptdubai.ae' WHERE full_name = 'Daniel Herbert';
UPDATE public.staff SET email = 'marina@ptdubai.ae' WHERE full_name = 'Marina';
UPDATE public.staff SET email = 'natasa.arsenijevic@ptdubai.ae' WHERE full_name = 'Natasa Arsenijevic';
UPDATE public.staff SET email = 'admin@ptdubai.ae' WHERE full_name = 'Unassigned / Admin';
