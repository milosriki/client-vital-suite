export interface MarketingDashboardData {
  zone_a: {
    title: string;
    metrics: {
      true_roas: number;
      cash_collected: number;
      ad_spend: number;
      new_leads: number;
      cpl: number;
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
      ad_name: string;
      spend: number;
      impressions: number;
      clicks: number;
      ctr: number;
      cpc: number;
    }[];
  };
  meta: {
    range: string;
    generated_at: string;
  };
}
