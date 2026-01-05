-- Fix unique constraint for Facebook insights upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'facebook_ads_insights_date_ad_id_key'
    ) THEN
        ALTER TABLE public.facebook_ads_insights ADD CONSTRAINT facebook_ads_insights_date_ad_id_key UNIQUE (date, ad_id);
    END IF;
END $$;
