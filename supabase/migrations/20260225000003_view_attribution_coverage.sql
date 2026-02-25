-- view_attribution_coverage: % of contacts with attribution data by lifecycle_stage
-- Answers: "How much of our pipeline has ad tracking?"
-- Attribution is considered present when any of:
--   attributed_ad_id, attributed_campaign_id, fb_ad_id, utm_source, or attribution_source
-- is non-null on the contact record.

CREATE OR REPLACE VIEW public.view_attribution_coverage AS
SELECT
    -- Stage identity
    COALESCE(c.lifecycle_stage, 'unknown')                                  AS lifecycle_stage,

    -- Volumes
    COUNT(*)                                                                AS total_contacts,
    COUNT(*) FILTER (
        WHERE c.attributed_ad_id       IS NOT NULL
           OR c.attributed_campaign_id IS NOT NULL
           OR c.fb_ad_id               IS NOT NULL
           OR c.utm_source             IS NOT NULL
           OR c.attribution_source     IS NOT NULL
    )                                                                       AS attributed_contacts,

    -- Coverage %
    ROUND(
        COUNT(*) FILTER (
            WHERE c.attributed_ad_id       IS NOT NULL
               OR c.attributed_campaign_id IS NOT NULL
               OR c.fb_ad_id               IS NOT NULL
               OR c.utm_source             IS NOT NULL
               OR c.attribution_source     IS NOT NULL
        ) * 100.0
        / NULLIF(COUNT(*), 0),
        1
    )                                                                       AS attribution_pct,

    -- Granular signal breakdown
    COUNT(*) FILTER (WHERE c.attributed_ad_id       IS NOT NULL)           AS with_ad_id,
    COUNT(*) FILTER (WHERE c.attributed_campaign_id IS NOT NULL)           AS with_campaign_id,
    COUNT(*) FILTER (WHERE c.fb_ad_id               IS NOT NULL)           AS with_fb_ad_id,
    COUNT(*) FILTER (WHERE c.utm_source             IS NOT NULL)           AS with_utm_source,
    COUNT(*) FILTER (WHERE c.attribution_source     IS NOT NULL)           AS with_attribution_source,

    -- Strongest signal: all 3 ad-level fields present
    COUNT(*) FILTER (
        WHERE c.attributed_ad_id       IS NOT NULL
          AND c.attributed_campaign_id IS NOT NULL
          AND c.attributed_adset_id    IS NOT NULL
    )                                                                       AS with_full_ad_attribution

FROM public.contacts c
GROUP BY COALESCE(c.lifecycle_stage, 'unknown')
ORDER BY
    CASE COALESCE(c.lifecycle_stage, 'unknown')
        WHEN 'subscriber'              THEN 1
        WHEN 'lead'                    THEN 2
        WHEN 'marketingqualifiedlead'  THEN 3
        WHEN 'salesqualifiedlead'      THEN 4
        WHEN 'opportunity'             THEN 5
        WHEN 'customer'                THEN 6
        WHEN 'evangelist'              THEN 7
        WHEN 'other'                   THEN 8
        ELSE                                9
    END;

GRANT SELECT ON public.view_attribution_coverage TO authenticated;
