-- Backup marketing tables before destructive dedup migration (20260213000006)
-- Rollback: DROP TABLE _backup_* (after 7 days of stable operation)

CREATE TABLE IF NOT EXISTS public._backup_marketing_agent_signals AS SELECT * FROM public.marketing_agent_signals;
CREATE TABLE IF NOT EXISTS public._backup_marketing_recommendations AS SELECT * FROM public.marketing_recommendations;
CREATE TABLE IF NOT EXISTS public._backup_marketing_budget_proposals AS SELECT * FROM public.marketing_budget_proposals;
CREATE TABLE IF NOT EXISTS public._backup_creative_library AS SELECT * FROM public.creative_library;
CREATE TABLE IF NOT EXISTS public._backup_marketing_fatigue_alerts AS SELECT * FROM public.marketing_fatigue_alerts;
CREATE TABLE IF NOT EXISTS public._backup_loss_analysis AS SELECT * FROM public.loss_analysis;
