-- Migration: Add Health Score V3 fields
-- Author: Antigravity
-- Date: 2026-02-09

ALTER TABLE IF EXISTS public.client_health_scores 
ADD COLUMN IF NOT EXISTS health_zone text,
ADD COLUMN IF NOT EXISTS churn_risk_score numeric,
ADD COLUMN IF NOT EXISTS health_trend text,
ADD COLUMN IF NOT EXISTS calculation_version text,
ADD COLUMN IF NOT EXISTS audit_source text,
ADD COLUMN IF NOT EXISTS behavioral_pattern text;

-- Create indexes for dashboard performance
CREATE INDEX IF NOT EXISTS idx_health_zone ON public.client_health_scores(health_zone);
CREATE INDEX IF NOT EXISTS idx_churn_risk ON public.client_health_scores(churn_risk_score DESC);
