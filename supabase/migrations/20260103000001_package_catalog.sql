-- 1. Create Package Catalog (The Source of Truth for Pricing)
CREATE TABLE IF NOT EXISTS public.package_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_name TEXT NOT NULL UNIQUE,
    stripe_product_id TEXT,
    base_price_aed DECIMAL(12, 2) NOT NULL,
    session_count INTEGER,
    is_subscription BOOLEAN DEFAULT FALSE,
    min_months INTEGER DEFAULT 1,
    duo_premium_per_session DECIMAL(12, 2) DEFAULT 100.00,
    installment_plans JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with PRECISE PTD Pricing from CEO
INSERT INTO public.package_catalog (package_name, base_price_aed, session_count, is_subscription, min_months)
VALUES 
('8 Session Subscription', 3000.00, 8, TRUE, 3), -- Example base, usually sub
('12 Session Package', 4725.00, 12, FALSE, 1),
('12 Session Subscription', 4725.00, 12, TRUE, 1),
('24 Session Package', 9450.00, 24, FALSE, 1),
('36 Session Package', 12889.80, 36, FALSE, 1),
('72 Session Package', 20000.00, 72, FALSE, 1), -- Approx from CEO
('144 Session Package', 41616.00, 144, FALSE, 1) -- 144 * 289 AED
ON CONFLICT (package_name) DO UPDATE 
SET base_price_aed = EXCLUDED.base_price_aed,
    session_count = EXCLUDED.session_count,
    is_subscription = EXCLUDED.is_subscription;

-- 2. Create Forensic Signatures (Dynamic knowledge, no hardcoding in functions)
CREATE TABLE IF NOT EXISTS public.forensic_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signature_type TEXT NOT NULL, -- 'IP', 'BANK_ACCOUNT', 'AMOUNT', 'CUSTOMER_ID'
    signature_value TEXT NOT NULL UNIQUE,
    description TEXT,
    severity TEXT DEFAULT 'critical',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with findings from Jan 2026 Audit
INSERT INTO public.forensic_signatures (signature_type, signature_value, description)
VALUES 
('IP', '94.204.168.142', 'Malicious IP - Data Export & Unlinking'),
('IP', '217.165.248.15', 'Malicious IP - Shadow Account Creation'),
('IP', '86.97.118.241', 'Abdallah Yassine IP'),
('BANK_ACCOUNT', '9001', 'RAKBANK Shadow Account Last4'),
('AMOUNT', '12889.80', 'Structuring Signature - Manual Invoice Pattern'),
('CUSTOMER_ID', 'cus_RWJklHZAESOV6f', 'DPG Events - Card Testing Actor'),
('CUSTOMER_ID', 'cus_RRsBwAi3ux8mYY', 'Fake Milos Identity Theft')
ON CONFLICT (signature_value) DO NOTHING;

-- Enable RLS
ALTER TABLE public.package_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access package_catalog" ON public.package_catalog FOR ALL USING (true);
CREATE POLICY "Service role full access forensic_signatures" ON public.forensic_signatures FOR ALL USING (true);
