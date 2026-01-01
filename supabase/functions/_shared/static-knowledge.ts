
export const PTD_STATIC_KNOWLEDGE = \`
PTD FITNESS PLATFORM - COMPLETE SYSTEM STRUCTURE:

=== DATABASE TABLES (110 total) ===

CORE BUSINESS:
- contacts (4279 rows): email, first_name, last_name, phone, lifecycle_stage, owner_name, lead_status, hubspot_contact_id, assigned_coach
- deals (4113 rows): deal_name, deal_value, stage, status, close_date, pipeline, hubspot_deal_id
- leads: id, name, email, phone, source, status, setter_id, closer_id
- appointments (258 rows): lead_id, scheduled_at, status, notes
- staff (5 rows): name, email, role (closer/setter/both)

HEALTH & RETENTION:
- client_health_scores (4279 rows): email, health_score, health_zone (RED/YELLOW/GREEN/PURPLE), churn_risk_score, engagement_score, momentum_score, assigned_coach
- coach_performance (5 rows): coach_name, total_clients, clients_red/yellow/green/purple, avg_client_health, performance_score
- intervention_log: client_email, trigger_reason, health_score, recommended_action, status, outcome
- daily_summary (13 rows): summary_date, avg_health_score, clients_red/yellow/green/purple, at_risk_revenue_aed
- proactive_insights (5 rows): contact_id, insight_type, priority, recommended_action, call_script

CALLS & COMMUNICATION:
- call_records (3935 rows): caller_number, duration_seconds, call_status, transcription, call_score, call_outcome, recording_url
- call_analytics: date, source, total_calls, answered_calls, conversion_rate
- call_tracking_numbers (3 rows): phone_number, source, campaign, forward_to

STRIPE & PAYMENTS:
- stripe_events (1380 rows): event_id, event_type, data, created_at
- stripe_transactions (20 rows): stripe_id, amount, currency, status, payment_method
- stripe_subscriptions (13 rows): stripe_id, customer_id, status, current_period_start/end
- stripe_invoices (29 rows): stripe_id, amount_paid, amount_due, status
- stripe_payouts (2 rows): stripe_id, amount, status, arrival_date, destination
- stripe_fraud_alerts (1 row): event_id, risk_score, signals, severity
- known_cards: card_fingerprint, card_last4, card_brand, is_trusted

HUBSPOT & CRM:
- hubspot_login_activity (2711 rows): user_email, occurred_at, ip_address, location
- hubspot_contact_changes: contact_id, property_name, old_value, new_value, user_email
- contact_activities: contact_id, activity_type, activity_title, occurred_at
- reassignment_log (45 rows): contact_id, old_owner_id, new_owner_id, reason

MARKETING & ATTRIBUTION:
- attribution_events (499 rows): event_name, email, source, campaign, platform, value
- facebook_campaigns (100 rows): campaign_id, campaign_name, spend, clicks, impressions, ctr
- facebook_ads_insights (35 rows): date, campaign_id, spend, impressions, clicks, leads
- events (1429 rows): event_name, user_data, source, status
- ultimate_truth_events: event_name, email, attribution_source, has_facebook_capi, has_hubspot, confidence_score

AI & MEMORY:
- agent_memory (2261 rows): thread_id, query, response, knowledge_extracted, embeddings
- agent_patterns (8 rows): pattern_name, description, confidence, usage_count
- agent_conversations (64 rows): session_id, role, content
- knowledge_base (17 rows): content, category, source, embedding
- knowledge_documents: filename, content, embedding
- global_memory (2 rows): memory_key, memory_value, memory_type (shared org-wide)
- server_sessions (1 row): session_id, device_fingerprint, browser_info
- server_memory: session_id, memory_key, memory_value
- ai_agent_approvals: request_type, description, code_changes, status
- org_memory_kv: namespace, key, value

SYSTEM:
- sync_logs (991 rows): platform, sync_type, status, records_processed
- sync_errors (3271 rows): error_type, source, error_message
- webhook_logs (186 rows): source, event_type, payload, processed

=== EDGE FUNCTIONS (107 deployed) ===

INTELLIGENCE & AI:
- ptd-agent-claude, ptd-agent-gemini, ptd-ultimate-intelligence, smart-agent
- agent-analyst, agent-orchestrator, super-agent-orchestrator
- ai-ceo-master, ai-deploy-callback, ai-trigger-deploy
- churn-predictor, anomaly-detector, intervention-recommender

DATA SYNC:
- sync-hubspot-to-supabase, sync-hubspot-data, hubspot-data-sync
- hubspot-webhook, hubspot-command-center, hubspot-analyzer, hubspot-live-query
- fetch-hubspot-live, fetch-callgear-data, fetch-forensic-data, fetch-facebook-insights

STRIPE:
- stripe-webhook, stripe-forensics, stripe-dashboard-data, stripe-payouts-ai
- stripe-payout-controls, stripe-history, stripe-find-charges, enrich-with-stripe

HEALTH & COACHING:
- health-calculator, coach-analyzer, daily-report, business-intelligence
- proactive-insights-generator, smart-coach-analytics, ptd-proactive-scanner
- ptd-24x7-monitor, ptd-self-learn, ptd-watcher

LEADS & CALLS:
- generate-lead-replies, generate-lead-reply, auto-reassign-leads, reassign-owner
- callgear-sentinel, callgear-live-monitor, callgear-supervisor, callgear-icp-router
- call-tracking, call-webhook, call-recording

MARKETING:
- facebook-conversion, facebook-webhook, facebook-ads-sync, facebook-data-sync
- anytrack-webhook, process-capi-batch, send-to-stape-capi, capi-validator
- ultimate-truth-alignment, marketing-stress-test

UTILITIES:
- verify-all-keys, data-quality, integration-health, pipeline-monitor
- generate-embeddings, process-knowledge, openai-embeddings
- cleanup-fake-contacts, calendly-webhook

HEALTH ZONES:
- Purple (85-100): Champions | Green (70-84): Healthy | Yellow (50-69): At Risk | Red (0-49): Critical

STRIPE FRAUD PATTERNS:
- Unknown cards after trusted payments
- Instant payouts bypassing settlement
- Test-then-drain pattern
- Multiple failed charges then success

BUSINESS RULES:
- No session in 14+ days = at risk
- Deals over 50K AED need approval
- Lead response target: under 5 minutes
\`;
