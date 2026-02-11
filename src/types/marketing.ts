export interface MarketingDashboardData {
  zone_a: {
    title: string;
    metrics: {
      true_roas: number;
      cash_collected: number;
      ad_spend: number;
      new_leads: number;
      cpl: number;
      integrity_score?: number; // [NEW] 0.0 to 1.x
    };
  };
  zone_b: {
    title: string;
    recent_activity: {
      deal_name: string;
      amount: number;
      stage: string;
      created_at: string;
    }[];
  };
  zone_c: {
    title: string;
    funnel: {
      impressions: number;
      clicks: number;
      leads: number;
      appointments: number;
      sales: number;
    };
  };
  zone_d: {
    title: string;
    top_performers: {
      ad_id: string;
      ad_name: string;
      spend: number;
      impressions: number;
      clicks: number;
      ctr: number;
      cpc: number;
      purchase_value?: number;
      leads?: number; // [NEW] From fetch-facebook-insights patch
      roas?: number; // [NEW] From fetch-facebook-insights patch
    }[];
  };
  truth?: {
    verified_lifetime_revenue: number;
    integrity_score: number;
  };
  meta: {
    range: string;
    generated_at: string;
  };
}
