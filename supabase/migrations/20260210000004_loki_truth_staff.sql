-- LOKI TRUTH: Final Staff Seeding
-- Ensures all AWS and HubSpot identities are resolved to UUIDs

INSERT INTO public.staff (full_name, hubspot_owner_id, role, status, is_active, email)
VALUES 
    -- SETTERS
    ('Matthew Twigg', '452974662', 'setter', 'active', true, 'matthew.twigg@ptdubai.ae'),
    ('Yehia Salah', '78722672', 'setter', 'active', true, 'yehia.salah@ptdubai.ae'),
    ('Marko Antic', 'marko_antic_id', 'setter', 'active', true, 'marko.antic@ptdubai.ae'),
    ('Mazen', '82655976', 'setter', 'active', true, 'mazen@ptdubai.ae'),
    ('Rebecca', 'rebecca_id', 'setter', 'active', true, 'rebecca@ptdubai.ae'),
    ('James', '80616467', 'setter', 'active', true, 'james@ptdubai.ae'),
    ('Tea Vukovic', '48899890', 'setter', 'active', true, 'tea.vukovic@ptdubai.ae'),
    ('Milos Vukovic', '48877837', 'admin', 'active', true, 'milos.vukovic@ptdubai.ae'),

    -- COACHES (AWS Ground Truth)
    ('Daniel Herbert', 'daniel_id', 'coach', 'active', true, 'daniel.herbert@ptdubai.ae'),
    ('Danijel Kenjic', 'danijel_id', 'coach', 'active', true, 'danijel.kenjic@ptdubai.ae'),
    ('Natasa Arsenijevic', 'natasa_id', 'coach', 'active', true, 'natasa.arsenijevic@ptdubai.ae'),
    ('Nicolas', 'nicolas_id', 'coach', 'active', true, 'nicolas@ptdubai.ae'),
    ('Zouheir Bouziri', 'zouheir_id', 'coach', 'active', true, 'zouheir.bouziri@ptdubai.ae'),
    ('David Popovic', 'david_id', 'coach', 'active', true, 'david.popovic@ptdubai.ae'),
    ('Faissal', 'faissal_id', 'coach', 'active', true, 'faissal@ptdubai.ae'),
    ('Marko', 'marko_id', 'coach', 'active', true, 'marko@ptdubai.ae'),
    ('Andrew Whiteson', 'andrew_id', 'coach', 'active', true, 'andrew.whiteson@ptdubai.ae'),
    ('Medya', 'medya_id', 'coach', 'active', true, 'medya@ptdubai.ae'),
    ('Nemanja', 'nemanja_id', 'coach', 'active', true, 'nemanja@ptdubai.ae'),
    ('Danni', 'danni_id', 'coach', 'active', true, 'danni@ptdubai.ae'),
    ('Darko Dencic', 'darko_id', 'coach', 'active', true, 'darko.dencic@ptdubai.ae'),
    ('Jovana Jezdimirovic', 'jovana_id', 'coach', 'active', true, 'jovana.jezdimirovic@ptdubai.ae'),
    ('Marina', 'marina_id', 'coach', 'active', true, 'marina@ptdubai.ae'),
    ('Renelly', 'renelly_id', 'coach', 'active', true, 'renelly@ptdubai.ae'),
    ('Sladjan Dimic', 'sladjan_id', 'coach', 'active', true, 'sladjan.dimic@ptdubai.ae'),
    ('Tayla', 'tayla_id', 'coach', 'active', true, 'tayla@ptdubai.ae'),
    ('Vukasin Dizdar', 'vukasin_id', 'coach', 'active', true, 'vukasin.dizdar@ptdubai.ae'),
    
    -- SYSTEM
    ('Unassigned / Admin', 'unassigned', 'admin', 'active', true, 'admin@ptdubai.ae')
ON CONFLICT (email) DO UPDATE SET
    hubspot_owner_id = EXCLUDED.hubspot_owner_id,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;
