-- Marketing UPSERT keys: dedup existing rows + create UNIQUE indexes
-- Rollback:
--   DROP INDEX IF EXISTS uq_signals_ad_type;
--   DROP INDEX IF EXISTS uq_recs_ad_action;
--   DROP INDEX IF EXISTS uq_proposals_rec_ad;
--   DROP INDEX IF EXISTS uq_creative_ad_version;
--   DROP INDEX IF EXISTS uq_fatigue_ad_type;
--   DROP INDEX IF EXISTS uq_loss_deal_contact;
--   Note: Deleted duplicates cannot be restored. Take a backup before running.

-- CRITICAL: Remove duplicates BEFORE creating UNIQUE indexes
-- Without this, CREATE UNIQUE INDEX fails on tables with existing dupes

-- Dedup marketing_agent_signals: keep newest per (ad_id, signal_type)
DELETE FROM public.marketing_agent_signals a
USING public.marketing_agent_signals b
WHERE a.id < b.id
  AND a.ad_id = b.ad_id
  AND a.signal_type = b.signal_type;

-- Dedup marketing_recommendations: keep newest per (ad_id, action)
DELETE FROM public.marketing_recommendations a
USING public.marketing_recommendations b
WHERE a.id < b.id
  AND a.ad_id = b.ad_id
  AND a.action = b.action;

-- Dedup marketing_budget_proposals: keep newest per (recommendation_id, ad_id)
DELETE FROM public.marketing_budget_proposals a
USING public.marketing_budget_proposals b
WHERE a.id < b.id
  AND a.recommendation_id = b.recommendation_id
  AND a.ad_id = b.ad_id;

-- Dedup creative_library: keep newest per (source_ad_id, prompt_version)
DELETE FROM public.creative_library a
USING public.creative_library b
WHERE a.id < b.id
  AND a.source_ad_id = b.source_ad_id
  AND a.prompt_version = b.prompt_version;

-- Dedup marketing_fatigue_alerts: keep newest per (ad_id, alert_type)
DELETE FROM public.marketing_fatigue_alerts a
USING public.marketing_fatigue_alerts b
WHERE a.id < b.id
  AND a.ad_id = b.ad_id
  AND a.alert_type = b.alert_type;

-- Dedup loss_analysis: keep newest per (deal_id, contact_email)
-- Note: deal_id may be NULL — use COALESCE
DELETE FROM public.loss_analysis a
USING public.loss_analysis b
WHERE a.id < b.id
  AND COALESCE(a.deal_id, '') = COALESCE(b.deal_id, '')
  AND a.contact_email = b.contact_email;

-- NOW create UNIQUE indexes (safe after dedup)
CREATE UNIQUE INDEX IF NOT EXISTS uq_signals_ad_type
  ON public.marketing_agent_signals(ad_id, signal_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recs_ad_action
  ON public.marketing_recommendations(ad_id, action);

CREATE UNIQUE INDEX IF NOT EXISTS uq_proposals_rec_ad
  ON public.marketing_budget_proposals(recommendation_id, ad_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_ad_version
  ON public.creative_library(source_ad_id, prompt_version);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fatigue_ad_type
  ON public.marketing_fatigue_alerts(ad_id, alert_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loss_deal_contact
  ON public.loss_analysis(COALESCE(deal_id, ''), contact_email);
