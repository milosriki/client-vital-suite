export interface MarketingCopywriterResponse {
  success: boolean;
  copy_generated: number;
  errors: number;
  winners_analyzed: number;
  prompt_version: string;
  message?: string;
}

export interface CleanupAgentMemoryResponse {
  success: boolean;
  results: {
    agent_memory_archived: number;
    agent_conversations_deleted: number;
    agent_decisions_deleted: number;
    agent_patterns_decayed: number;
  };
}

export interface SystemHealthCheckResponse {
  healthy: boolean;
  services: Record<string, string>;
  timestamp: string;
}

export interface StripeEnterpriseResponse {
  metrics: {
    totalRevenue: number;
    totalNet: number;
    activeSubscriptionsMRR: number;
    currency: string;
  };
  dataQuality: "complete" | "partial" | "error";
  fetchedAt: string;
}

// Map function names to their response types
export interface EdgeFunctions {
  "marketing-copywriter": {
    response: MarketingCopywriterResponse;
    body: {};
  };
  "cleanup-agent-memory": {
    response: CleanupAgentMemoryResponse;
    body: {};
  };
  "system-health-check": {
    response: SystemHealthCheckResponse;
    body: {};
  };
  "stripe-enterprise-intelligence": {
    response: StripeEnterpriseResponse;
    body: {
      action: "fetch-enterprise-data" | "enterprise-chat";
      message?: any;
      dateRange?: { from: string; to: string };
    };
  };
}
