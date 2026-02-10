/**
 * Enterprise Integration Types
 * Type definitions for HubSpot, Stripe, CallGear, and Meta integrations
 */

// ============================================================================
// HUBSPOT
// ============================================================================

export interface HubSpotContact {
  id: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  lifecyclestage?: string;
  hs_lead_status?: string;
  hubspot_owner_id?: string;
  createdate: string;
  lastmodifieddate: string;
  properties: Record<string, string | number | null>;
}

export interface HubSpotDeal {
  id: string;
  dealname: string;
  amount?: number;
  dealstage: string;
  pipeline: string;
  closedate?: string;
  createdate: string;
  associated_contact_ids: string[];
}

// ============================================================================
// STRIPE
// ============================================================================

export interface StripeSubscription {
  id: string;
  customer_id: string;
  status: "active" | "past_due" | "canceled" | "trialing" | "incomplete";
  plan_name: string;
  amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed" | "refunded";
  customer_id: string;
  description?: string;
  created: string;
  metadata?: Record<string, string>;
}

export interface StripeMRRData {
  mrr: number;
  arr: number;
  change: number;
  changePercentage: number;
  period: string;
  currency: string;
}

// ============================================================================
// CALLGEAR
// ============================================================================

export interface CallRecord {
  id: string;
  caller_number: string;
  destination_number: string;
  direction: "inbound" | "outbound";
  duration_seconds: number;
  status: "answered" | "missed" | "voicemail" | "busy";
  recording_url?: string;
  started_at: string;
  ended_at?: string;
  contact_id?: string;
  assigned_to?: string;
}

// ============================================================================
// META / FACEBOOK
// ============================================================================

export interface FacebookAdInsight {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  ad_id?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  date_start: string;
  date_stop: string;
}

export interface MarketingAttribution {
  source:
    | "facebook"
    | "google"
    | "hubspot"
    | "anytrack"
    | "organic"
    | "referral";
  medium: string;
  campaign?: string;
  leads: number;
  revenue: number;
  cpl: number;
  roas: number;
  confidence: number;
}
