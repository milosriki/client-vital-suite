-- Create Agent Swarms for Hierarchical Orchestration
CREATE TABLE IF NOT EXISTS public.agent_swarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swarm_name TEXT NOT NULL UNIQUE,
    description TEXT,
    functions TEXT[], -- List of edge function names
    thinking_level TEXT DEFAULT 'medium', -- 'minimal', 'low', 'medium', 'high'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Map the 107 functions into 5 Strategic Teams
INSERT INTO public.agent_swarms (swarm_name, description, thinking_level, functions)
VALUES 
('FORENSIC', 'Detects fraud, traces money, audits payments.', 'high', 
 ARRAY['stripe-forensics', 'client-payment-integrity', 'anomaly-detector', 'stripe-payouts-ai']),

('SALES', 'Monitors lead velocity, follow-ups, and conversion.', 'medium', 
 ARRAY['sync-hubspot-to-supabase', 'pipeline-monitor', 'lead-control', 'auto-reassign-leads']),

('GROWTH', 'Analyzes ROAS, campaign performance, and scaling.', 'high', 
 ARRAY['facebook-ads-sync', 'business-intelligence', 'marketing-stress-test', 'fetch-facebook-insights']),

('RETENTION', 'Predicts churn, calculates health, triggers interventions.', 'medium', 
 ARRAY['health-calculator', 'churn-predictor', 'intervention-recommender', 'coach-analyzer']),

('OPS', 'System health, call records, and data integrity.', 'low', 
 ARRAY['callgear-supervisor', 'call-tracking', 'data-quality', 'integration-health'])
ON CONFLICT (swarm_name) DO UPDATE 
SET functions = EXCLUDED.functions,
    thinking_level = EXCLUDED.thinking_level;
