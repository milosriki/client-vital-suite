# Database Schema Map by Dashboard Group

> Generated from `src/integrations/supabase/types.ts` and `docs/INTELLIGENCE_VISION.md`.  
> Categorizes all tables, views, RPCs, and key joins for focused dashboard development.

---

## KEY JOINS BETWEEN GROUPS

| From | To | Join Path |
|------|-----|-----------|
| **contacts** | deals | `deals.contact_id = contacts.id` |
| **contacts** | call_records | `call_records.caller_number = contacts.phone` (no FK; match by phone) |
| **contacts** | attribution_events | `attribution_events.contact_id = contacts.id` |
| **contacts** | stripe_transactions | `stripe_transactions.contact_id = contacts.id` |
| **contacts** | aws_truth_cache | `aws_truth_cache.email = contacts.email` |
| **contacts** | client_health_scores | `client_health_scores.email = contacts.email` |
| **deals** | contacts | `deals.contact_id = contacts.id` |
| **deals** | staff | `deals.closer_id = staff.id`, `deals.owner_id` → HubSpot owner |
| **attribution_events** | facebook_ads_insights | `attribution_events.fb_ad_id = facebook_ads_insights.ad_id` |
| **contacts** | facebook_ads_insights | via `contacts.attributed_ad_id` or `attribution_events.fb_ad_id` |
| **call_records** | contacts | `call_records.caller_number = contacts.phone` |
| **call_records** | staff | `call_records.hubspot_owner_id` → HubSpot owner ID (string) |
| **stripe_transactions** | contacts | `stripe_transactions.contact_id = contacts.id` |
| **deals** | stripe_transactions | via `deal_stripe_revenue` view: deals → contacts → known_cards → stripe |

---

## Group 1: CONTACT/LEAD Data (Client Management Dashboard)

### Tables
| Table | Key Columns for Joins |
|-------|------------------------|
| **contacts** | `id`, `hubspot_contact_id`, `email`, `phone`, `owner_id`, `owner_name`, `lifecycle_stage`, `lead_status`, `attributed_ad_id`, `attributed_campaign_id`, `attributed_adset_id` |
| **contact_activities** | `contact_id` → contacts.id |
| **contact_ownership_history** | `contact_id` → contacts.id |
| **companies** | `id` (contacts.company_id) |
| **leads** | `id`, `setter_id`, `closer_id` → staff.id |
| **sales_leads** | lead/sales pipeline data |
| **spark_leads** | spark-specific leads |
| **enhanced_leads** | enriched lead data |
| **lead_events** | lead event tracking |
| **lead_states** | lead state machine |
| **lead_ai_replies** | AI reply history |
| **appointments** | `lead_id` → leads.id |
| **customer_profiles** | customer profile data |
| **customer_journeys** | journey tracking |
| **reassignment_log** | `contact_id` |
| **hubspot_contact_changes** | HubSpot sync audit |
| **hubspot_activity_cache** | HubSpot activity cache |
| **hubspot_user_daily_summary** | owner daily stats |

### Views
| View | Purpose |
|------|---------|
| **cold_leads** | Unworked/cold leads with urgency |
| **lead_full_journey** | Full lead journey with contact_id |
| **lead_lifecycle_view** | Lifecycle stages |
| **long_cycle_protection** | Long sales cycle alerts |
| **vw_sales_contacts** | Sales-focused contact view |
| **customer_journey_view** | Journey with contact_id |
| **dynamic_funnel_view** | Funnel by contact_id |
| **upcoming_assessments** | Assessment bookings by contact_id |
| **view_atlas_lead_dna** | Atlas lead DNA (contact_id) |
| **view_contact_360** | 360° contact view |
| **view_enterprise_truth_genome** | Truth genome by contact_id |
| **campaign_lead_attribution** | Contact + UTM + setter (contact_id) |
| **journey_timeline_events** | Journey timeline by contact |

### RPCs/Functions
| Function | Purpose |
|----------|---------|
| `calculate_lead_score` | Compute lead score from params |
| `get_underworked_leads` | Leads with min_attempts below threshold |
| `manual_link_deal_contact` | Link deal to contact |
| `process_hubspot_webhook` | HubSpot webhook processing |

### Key Columns for Joins
- `contacts.id` — primary key; referenced by deals, contact_activities, stripe_transactions, attribution_events
- `contacts.hubspot_contact_id` — HubSpot sync key
- `contacts.phone` — matches call_records.caller_number
- `contacts.email` — matches aws_truth_cache, client_health_scores
- `contacts.owner_id` — HubSpot owner (string)

---

## Group 2: DEAL/REVENUE Data (Revenue Dashboard)

### Tables
| Table | Key Columns for Joins |
|-------|------------------------|
| **deals** | `id`, `contact_id` → contacts.id, `lead_id` → leads.id, `appointment_id`, `closer_id` → staff.id, `owner_id`, `stage`, `deal_value`, `cash_collected`, `status` |
| **stripe_transactions** | `id`, `contact_id` → contacts.id, `customer_id`, `amount`, `status` |
| **stripe_subscriptions** | subscription data |
| **stripe_invoices** | invoice data |
| **stripe_refunds** | refund tracking |
| **stripe_payouts** | payout data |
| **stripe_balances** | balance snapshots |
| **stripe_accounts** | account config |
| **stripe_events** | webhook events |
| **stripe_fraud_alerts** | fraud alerts |
| **stripe_outbound_transfers** | transfers |
| **client_payment_history** | payment history |
| **package_catalog** | package definitions |
| **account_review_history** | `event_id` → stripe_events |
| **loss_analysis** | Deal loss reasons with evidence (primary/secondary, confidence) |

### Views
| View | Purpose |
|------|---------|
| **deal_stripe_revenue** | Deals + revenue via contacts → known_cards → stripe |
| **v_active_pipeline** | Active pipeline deals |
| **v_conversion_funnel** | Conversion funnel |
| **vw_active_clients** | Active paying clients |

### RPCs/Functions
| Function | Purpose |
|----------|---------|
| `get_revenue_data` | Revenue by day/leads/purchases |
| `get_stale_deals` | Deals stale by hours_threshold |
| `manual_link_deal_contact` | Link deal to contact |

### Key Columns for Joins
- `deals.contact_id` → contacts.id
- `deals.owner_id` — HubSpot owner (string)
- `deals.stage` — e.g. closedwon, 122237508 (assessment booked)
- `stripe_transactions.contact_id` → contacts.id
- `stripe_transactions.customer_id` — Stripe customer (links via known_cards.email)

---

## Group 3: MARKETING/ATTRIBUTION Data (Marketing Dashboard)

### Tables
| Table | Key Columns for Joins |
|-------|------------------------|
| **attribution_events** | `id`, `contact_id`, `event_name`, `fb_ad_id`, `fb_adset_id`, `fb_campaign_id`, `value`, `event_time` |
| **attribution_models** | model config |
| **facebook_ads_insights** | `id`, `ad_id`, `adset_id`, `campaign_id`, `spend`, `leads`, `impressions`, `clicks`, `date` |
| **facebook_campaigns** | `campaign_id`, campaign metadata |
| **facebook_creatives** | creative metadata |
| **facebook_leads** | FB lead forms |
| **marketing_costs** | cost tracking |
| **conversion_events** | conversion tracking |
| **conversion_tracking** | tracking config |
| **touchpoints** | touchpoint sequence |
| **audience_definitions** | audience config |
| **analytics_events** | analytics event log |
| **events** | event tracking |
| **events_raw** | raw event stream |
| **funnel_metrics** | funnel stage metrics (booked, held, closed, ghost rate, etc.) |
| **historical_baselines** | 90d ROAS, CPL baselines by period_days |

### Views
| View | Purpose |
|------|---------|
| **ad_creative_funnel** | Ad-level funnel (spend, leads, booked, closed_won, ROAS, CPL) |
| **adset_full_funnel** | Adset-level funnel |
| **campaign_full_funnel** | Campaign-level funnel |
| **campaign_intelligence** | Campaign health, cold/hot leads, setter metrics |
| **campaign_performance** | Campaign performance summary |
| **campaign_lead_attribution** | Contact + UTM + setter |
| **creative_performance** | Creative-level metrics |
| **facebook_campaign_performance** | FB campaign perf |
| **facebook_hubspot_crosscheck** | FB vs HubSpot cross-check |
| **hubspot_campaign_performance** | HubSpot campaign perf |
| **source_discrepancy_matrix** | Source truth comparison |
| **view_marketing_attribution** | Marketing attribution view |

### RPCs/Functions
| Function | Purpose |
|----------|---------|
| `calculate_attribution_weights` | Attribution weight calculation |
| `get_campaign_money_map` | CPL, CPO, ROAS per campaign |

### Key Columns for Joins
- `attribution_events.fb_ad_id` = facebook_ads_insights.ad_id
- `attribution_events.contact_id` = contacts.id
- `contacts.attributed_ad_id`, `attributed_campaign_id`, `attributed_adset_id`
- `facebook_ads_insights.ad_id`, `adset_id`, `campaign_id`

---

## Group 4: CALL Data (Call Analytics Dashboard)

### Tables
| Table | Key Columns for Joins |
|-------|------------------------|
| **call_records** | `id`, `caller_number` (= contacts.phone), `hubspot_owner_id`, `call_status`, `duration_seconds`, `call_score`, `call_outcome`, `appointment_set`, `tracking_number_id` |
| **call_analytics** | aggregated call analytics |
| **call_integrations** | integration config |
| **call_tracking_numbers** | `id` ← call_records.tracking_number_id |
| **call_transcription_jobs** | `call_record_id` → call_records.id |

### Views
| View | Purpose |
|------|---------|
| **call_attribution** | Call + contact + deal + FB ad (via caller_number → contacts.phone) |
| **contact_call_performance** | Per-contact call stats (contact_id) |

### RPCs/Functions
- (No call-specific RPCs; use call_attribution view for joins)

### Key Columns for Joins
- `call_records.caller_number` = contacts.phone (no FK)
- `call_records.hubspot_owner_id` — setter/owner (string, matches HubSpot)
- `call_records.tracking_number_id` → call_tracking_numbers.id
- `call_attribution.contact_id`, `call_id`, `deal_id` — pre-joined view

---

## Group 5: HEALTH/COACHING Data (Health Dashboard)

### Tables
| Table | Key Columns for Joins |
|-------|------------------------|
| **client_health_scores** | `email`, `hubspot_contact_id`, `health_score`, `health_zone`, `assigned_coach`, `sessions_last_7d/30d/90d` |
| **aws_truth_cache** | `email`, `total_sessions_attended`, `lifetime_revenue`, `coach_name`, `outstanding_sessions` |
| **coach_performance** | coach metrics |
| **coach_reviews** | review data |
| **trainer_performance** | trainer metrics |
| **daily_summary** | daily health summary |
| **daily_business_metrics** | business metrics |
| **client_lifecycle_history** | `email`, health history |
| **churn_patterns** | churn analysis |
| **intervention_log** | intervention tracking |
| **intervention_outcomes** | `intervention_id` → intervention_log |
| **proactive_insights** | `contact_id` → contacts.id |
| **member_analytics** | member analytics |

### Views
| View | Purpose |
|------|---------|
| **weekly_health_summary** | Weekly health summary |
| **view_coach_capacity_load** | Coach capacity |
| **view_segment_capacity_hud** | Segment capacity HUD |
| **vw_active_clients** | Active clients |
| **daily_analytics** | Daily analytics (materialized; refreshed via refresh_daily_analytics) |

### RPCs/Functions
| Function | Purpose |
|----------|---------|
| `get_dashboard_metrics` | Follow-up, no_show, total appointments, etc. |
| `get_calibration_examples` | Calibration examples for AI |

### Key Columns for Joins
- `client_health_scores.email` = contacts.email
- `aws_truth_cache.email` = contacts.email
- `client_health_scores.hubspot_contact_id` = contacts.hubspot_contact_id
- `proactive_insights.contact_id` = contacts.id

---

## Group 6: AI/AGENT Data (AI Tools)

### Tables
| Table | Key Columns for Joins |
|-------|------------------------|
| **agent_context** | `key`, `value`, `agent_type` |
| **agent_conversations** | `session_id`, `user_id` |
| **agent_decisions** | `agent_id`, decision tracking |
| **agent_knowledge** | `category`, `content`, `embedding` |
| **agent_learnings** | learning records |
| **agent_memory** | agent memory |
| **agent_patterns** | pattern storage |
| **agent_runs** | run tracking |
| **agent_skills** | skill definitions |
| **agent_swarms** | swarm config |
| **agent_tasks** | task tracking |
| **ai_agent_approvals** | approval workflow |
| **ai_execution_metrics** | execution metrics |
| **ai_feedback_learning** | `insight_id`, `intervention_id` |
| **ai_insights** | AI insights |
| **ai_learning_rules** | learning rules |
| **conversation_intelligence** | `phone` — Lisa/WhatsApp intel |
| **conversation_summaries** | conversation summaries |
| **whatsapp_interactions** | WhatsApp message log |
| **knowledge_base** | knowledge base |
| **knowledge_base_backup** | backup |
| **knowledge_documents** | documents |
| **memory_chunks** | `document_id` → memory_documents |
| **memory_documents** | document store |
| **global_memory** | global memory |
| **org_memory_kv** | org key-value |
| **server_memory** | server memory |
| **server_context** | server context |
| **user_memory** | user memory |
| **user_knowledge** | user knowledge |
| **prepared_actions** | prepared AI actions |
| **facts** | fact store |

### RPCs/Functions
| Function | Purpose |
|----------|---------|
| `match_knowledge` | RAG search on agent_knowledge |
| `match_memories` | RAG search on memories |
| `rag_search_memory_chunks` | RAG search memory chunks |
| `cleanup_old_agent_memory` | Retention cleanup |
| `expire_old_prepared_actions` | Expire prepared actions |

### Key Columns for Joins
- `conversation_intelligence.phone` = contacts.phone
- `ai_feedback_learning.insight_id` → proactive_insights
- `ai_feedback_learning.intervention_id` → intervention_log

---

## Group 7: SYSTEM/CONFIG Data (Admin Only)

### Tables
| Table | Key Columns for Joins |
|-------|------------------------|
| **app_settings** | app config |
| **system_settings** | system config |
| **system_preferences** | preferences |
| **system_metrics** | system metrics |
| **platform_connections** | integration connections |
| **platform_metrics** | platform metrics |
| **staff** | `id`, staff members (deals.closer_id, leads.setter_id) |
| **user_profiles** | user profiles |
| **user_roles** | role assignments |
| **user_preferences** | user prefs |
| **devices** | device registry |
| **device_request_logs** | `device_id` → devices |
| **edge_function_logs** | EF logs |
| **webhook_logs** | webhook logs |
| **sync_errors** | sync error tracking |
| **sync_log** | sync log |
| **sync_logs** | sync logs |
| **sync_queue** | sync queue |
| **excel_sync_logs** | Excel sync |
| **request_telemetry** | request telemetry |
| **response_safety_log** | safety log |
| **diagnostics** | diagnostics |
| **schema_introspection_audit** | schema audit |
| **token_usage_metrics** | token usage |
| **tokens** | token store |
| **management_activity_audit** | management audit |
| **management_daily_reports** | daily reports |
| **business_calibration** | `action_id` → prepared_actions |
| **business_forecasts** | forecasts |
| **business_goals** | goals |
| **business_reports** | reports |
| **business_rules** | rules |
| **update_source_log** | update source log |
| **forensic_signatures** | forensic data |
| **ultimate_truth_events** | Cross-source truth events (HubSpot, Stripe, PostHog) |

### Views
| View | Purpose |
|------|---------|
| **vw_management_discrepancies** | Management discrepancies |

### RPCs/Functions
| Function | Purpose |
|----------|---------|
| `check_settings` | Settings check |
| `check_sync_health` | Sync health status |
| `cleanup_old_logs` | Log cleanup |
| `cleanup_update_source_log` | Update source log cleanup |
| `execute_sql_query` | Admin SQL execution |
| `get_all_functions` | List functions |
| `get_all_tables` | List tables |
| `get_data_freshness` | Data freshness |
| `get_database_size` | DB size |
| `get_service_role_key` | Service role key (admin) |
| `get_supabase_url` | Supabase URL |
| `get_table_columns` | Table column metadata |
| `introspect_schema_verbose` | Full schema introspection |
| `is_admin` | Admin check |
| `has_role` | Role check |
| `refresh_daily_analytics` | Refresh materialized data |
| `refresh_platform_metrics` | Refresh platform metrics |
| `refresh_revenue_genome` | Refresh revenue genome |
| `trigger_immediate_truth_sync` | Trigger truth sync |
| `normalize_phone` | Phone normalization |

---

## Cross-Group Intelligence Views

These views span multiple groups and power the Deep Intelligence / Atlas dashboards:

| View | Groups | Purpose |
|------|--------|---------|
| **mv_enterprise_truth_genome** | 1,2,3,4,5 | Materialized: contact + deal + call + attribution truth |
| **view_enterprise_truth_genome** | 1,2,3,4,5 | Non-MV version |
| **ultimate_truth_dashboard** | 2,3,5 | Ultimate truth metrics |
| **view_truth_triangle** | 2,3 | HubSpot vs Stripe vs PostHog |
| **source_discrepancy_matrix** | 2,3 | Source truth comparison |
| **setter_funnel_matrix** | 1,2,4 | Setter funnel by hubspot_owner_id |
| **funnel_metrics** (table) | 1,2,3,4 | Funnel stage metrics |
| **historical_baselines** | 3 | 90d ROAS, CPL baselines |
| **loss_analysis** | 2 | Deal loss reasons |
| **v_followup_queue** | 1,4 | Follow-up queue |

---

## Enums

| Enum | Values |
|------|--------|
| `app_role` | admin, user |
| `deal_status` | pending, closed, cancelled, lost |
| `lead_status` | new, appointment_set, appointment_held, pitch_given, closed, no_show, follow_up, rescheduled |

---

## Essential Files for Understanding

- `src/integrations/supabase/types.ts` — Generated types (tables, views, functions)
- `docs/INTELLIGENCE_VISION.md` — Dashboard formulas, data flow, agent requirements
- `supabase/migrations/20260213140002_call_attribution_view.sql` — call_records → contacts join
- `supabase/migrations/20260216000001_multi_source_reconciliation.sql` — call_attribution, mv_enterprise_truth_genome
- `supabase/migrations/20260217000000_add_stripe_contact_fk.sql` — stripe_transactions.contact_id FK
