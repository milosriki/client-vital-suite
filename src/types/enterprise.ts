export interface TruthGenomeRecord {
  contact_id: string;
  lead_name: string;
  email: string;
  city: string | null;
  stage: string | null;
  first_touch_source: string | null;
  ad_id: string | null;
  verified_cash: number;
  payback_days: number | null;
  lead_intent_iq: number;
  avg_call_min: number;
  atlas_verdict: 'VERIFIED WINNER' | 'HIGH INTENT PENDING' | 'ACTIVE PIPELINE' | 'PROSPECTING';
  last_reconciled_at?: string;
}

export interface SegmentCapacity {
  zone: string;
  gender: string;
  coach_count: number;
  avg_segment_load: number;
  total_segment_sessions: number;
}

export interface CoachCapacityRecord {
  zone: string;
  gender: string;
  coach_name: string;
  sessions_14d: number;
  load_percentage: number;
  capacity_status: 'CRITICAL' | 'LIMITED' | 'SCALABLE';
}

export interface CallAnalyticsMetrics {
  totalCalls: number;
  avgIntentIQ: number;
  bookingConversionRate: number;
  revenueShadow: number;
}

export interface EnrichedCallRecord {
  id: string;
  lead_name: string;
  direction: 'inbound' | 'outbound';
  duration_seconds: number;
  intent_iq: number;
  verdict: string;
  coach: string;
  status: string;
  created_at: string;
}

export interface FunctionHealthRecord {
  function_name: string;
  status: 'healthy' | 'warning' | 'error';
  avg_latency_ms: number;
  last_run: string;
  total_calls: number;
  error_count: number;
  total_cost: number;
}

export interface AdvisorIntervention {
  id: string;
  client_name: string;
  email: string;
  health_score: number;
  health_zone: string;
  risk_label: string;
  reason: string;
  deal_value_aed: number;
  assigned_coach: string;
  days_since_last_session: number | null;
  outstanding_sessions: number;
  script?: string;
  type: 'High Priority' | 'Upsell' | 'Re-engagement';
}

export interface ClientXRayRecord {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  health_score: number;
  health_zone: string;
  assigned_coach: string;
  days_since_last_session: number | null;
  outstanding_sessions: number;
  calculated_on: string;
}

export interface KnowledgeEntry {
  id: string;
  content: string;
  source: string | null;
  category: string | null;
  confidence: number | null;
  created_at: string | null;
}
