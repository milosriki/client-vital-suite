CREATE OR REPLACE VIEW view_agent_cost_summary AS
SELECT 
  function_name,
  DATE(created_at) as day,
  model,
  COUNT(*) as calls,
  AVG(latency_ms) as avg_latency_ms,
  SUM(tokens_in) as total_input_tokens,
  SUM(tokens_out) as total_output_tokens,
  SUM(cost_usd_est) as total_cost_usd
FROM ai_execution_metrics
GROUP BY function_name, DATE(created_at), model
ORDER BY day DESC, calls DESC;
