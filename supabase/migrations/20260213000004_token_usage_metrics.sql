-- Token usage tracking for cost attribution and budget alerts.
-- Rollback: DROP TABLE IF EXISTS public.token_usage_metrics;

CREATE TABLE IF NOT EXISTS public.token_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model_used text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tum_function_date ON public.token_usage_metrics(function_name, created_at DESC);
CREATE INDEX idx_tum_model ON public.token_usage_metrics(model_used, created_at DESC);

GRANT SELECT, INSERT ON public.token_usage_metrics TO authenticated;

COMMENT ON TABLE public.token_usage_metrics IS 'Per-call token usage tracking for cost attribution and budget alerts.';
