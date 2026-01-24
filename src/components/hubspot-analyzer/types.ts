export interface CriticalMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
  totalProperties: number;
  contactProperties: number;
  dealProperties: number;
  revenueAtRisk: number;
  monthlyRevenueLoss: number;
  buriedPremiumLeads: number;
  potentialRecovery: number;
  slaBreachRate: number;
  blankLeadPercentage: number;
}

export interface CriticalIssue {
  severity: "critical" | "high" | "medium";
  title: string;
  description: string;
  impact: string;
  action: string;
}

export interface Recommendation {
  priority: number;
  title: string;
  description: string;
  effort: "Low" | "Medium" | "High";
  impact: "Critical" | "High" | "Medium";
  revenue: string;
}
