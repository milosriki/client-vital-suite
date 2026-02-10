import { ToolDefinition } from "./unified-ai-client.ts";

// ============= TOOL DEFINITIONS (Consolidated) =============
// This replaces the inline definitions in ptd-agent-gemini/index.ts
// Goal: Reduce tool count from 34 -> ~15 high-power tools to prevent context fragmentation.

export const tools: ToolDefinition[] = [
  // 1. CLIENT DATA SUITE (Merged client_control, get_at_risk, get_coach_clients)
  {
    name: "client_control",
    description:
      "MASTER CLIENT TOOL - Get full client profiles, health scores, financial history, and risks. Use for specific clients OR lists of clients (at-risk, by coach).",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "get_profile", // Single client full profile
            "get_health", // Health score specific
            "get_financials", // Deals & payments
            "get_activities", // Recent logs
            "get_at_risk", // List RED/YELLOW clients
            "get_by_coach", // List clients for a coach
          ],
          description: "Action to perform",
        },
        email: {
          type: "string",
          description: "Client email (Required for profile/health/financials)",
        },
        coach_name: {
          type: "string",
          description: "Coach name (Required for get_by_coach)",
        },
        zone: {
          type: "string",
          enum: ["red", "yellow", "all"],
          description: "Health zone filter (Required for get_at_risk)",
        },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["action"],
    },
  },

  // 2. LEAD MANAGEMENT
  {
    name: "lead_control",
    description:
      "Manage leads - get all leads, search leads, get enhanced lead data with scores",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get_all", "search", "get_enhanced", "get_by_status"],
          description: "Action to perform",
        },
        query: {
          type: "string",
          description: "Search query for lead name/email/phone",
        },
        status: { type: "string", description: "Lead status filter" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["action"],
    },
  },

  // 3. SALES INTELLIGENCE (Merged sales_flow, analytics to some degree)
  {
    name: "sales_flow_control",
    description:
      "Track sales pipeline - get deals, appointments, pipeline stages, recent closes",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "get_pipeline",
            "get_deals",
            "get_appointments",
            "get_recent_closes",
            "get_assessment_report",
            "get_conversion_metrics",
          ],
          description:
            "Action to perform. 'get_assessment_report' returns daily assessment count broken down by Setter.",
        },
        stage: {
          type: "string",
          description: "Optional: filter by pipeline stage",
        },
        days: { type: "number", description: "Days back to look (default 30)" },
      },
      required: ["action"],
    },
  },

  // 3.5 SOCIAL PROOF (New - Loki v1.0)
  {
    name: "get_success_stories",
    description:
      "Get verified client success stories/testimonials. Use this when a lead is skeptical or asks for proof.",
    input_schema: {
      type: "object",
      properties: {
        goal_type: {
          type: "string",
          enum: [
            "weight_loss",
            "muscle_gain",
            "injury_recovery",
            "general_fitness",
          ],
          description: "Filter by goal type (optional, defaults to random mix)",
        },
        limit: { type: "number", description: "Max results (default 3)" },
      },
    },
  },

  // 4. BUSINESS INTELLIGENCE (Merged intelligence_control, get_coach_performance, get_daily_summary)
  {
    name: "intelligence_control",
    description:
      "Business Intelligence Engine: Analyze retention, conversion, churn, revenue patterns, and COACH PERFORMANCE.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "coach_retention", // Best coaches
            "coach_performance", // Specific coach stats
            "goal_conversion", // Best niches
            "churn_analysis", // Why are people leaving?
            "revenue_trends", // General revenue trends
            "daily_summary", // Daily business snapshot
          ],
          description: "Analysis to run.",
        },
        coach_name: { type: "string", description: "Optional: specific coach" },
        date: { type: "string", description: "Optional: date for summary" },
      },
      required: ["action"],
    },
  },

  // 5. FINANCIAL SUPER-TOOL (Stripe + Revenue Truth)
  {
    name: "revenue_intelligence",
    description:
      "THE FINANCIAL TRUTH ENGINE - Use this for ALL revenue questions. Returns Audit-Grade validated revenue (HubSpot + Stripe).",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: [
            "this_month",
            "last_30d",
            "last_90d",
            "this_year",
            "last_year",
            "all_time",
          ],
          description: "Time period for revenue audit (default: this_month)",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "stripe_forensics",
    description:
      "PAYMENT INVESTIGATOR - Use this for failed payments, disputes, potential fraud, and payout issues.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "analyze_failures",
            "check_disputes",
            "check_payouts",
            "fraud_signals",
          ],
          description: "Forensic action to perform",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 20)",
        },
      },
      required: ["action"],
    },
  },

  // 6. COMMUNICATIONS SUITE (CallGear)
  {
    name: "callgear_control",
    description:
      "Call Analytics & Recordings - Get transcripts, call logs, employee stats.",
    input_schema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
        date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "callgear_live_monitor",
    description: "REAL-TIME CALL MONITORING - See who is on a call right now.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list_active_calls", "get_employee_status", "get_queue_stats"],
          description: "What to fetch",
        },
      },
      required: ["action"],
    },
  },

  // 7. MARKETING SUITE (Meta Ads)
  {
    name: "meta_ads_analytics",
    description:
      "Get performance metrics (ROAS, CPC, CTR) for Ad Accounts, Campaigns, or specific Ads.",
    input_schema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["account", "campaign", "adset", "ad"],
          description: "Level of aggregation",
        },
        date_preset: {
          type: "string",
          description: "Time range (e.g. last_7d, last_30d, today)",
        },
        limit: { type: "number", description: "Max results" },
      },
      required: ["level"],
    },
  },

  // 8. INFRASTRUCTURE & UTILITY
  {
    name: "universal_search",
    description:
      "POWERFUL SEARCH - Find any person/lead/contact by phone, email, name. Returns full profile. USE THIS for any 'Find X' query.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term",
        },
        search_type: {
          type: "string",
          enum: ["auto", "phone", "email", "name"],
          description: "Type of search",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "location_control",
    description: "Google Maps: Validate UAE addresses and check distances.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["validate", "check_distance"] },
        address: { type: "string", description: "Address to check" },
        destination: { type: "string", description: "Destination address" },
      },
      required: ["action", "address"],
    },
  },
  {
    name: "aws_data_query",
    description:
      "READ-ONLY access to AWS RDS (PowerBI Source). Use to double-check HubSpot data.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "discover_schema",
            "trainer_performance",
            "client_session_health",
            "ask",
          ],
        },
        question: { type: "string", description: "Natural language query" },
      },
      required: ["action"],
    },
  },
  {
    name: "system_error_audit",
    description: "Audit system logs and errors.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["analyze_error_patterns"] },
        days: { type: "number", description: "Days to analyze" },
      },
      required: ["action"],
    },
  },
  {
    name: "run_sql_query",
    description: "Run a read-only SQL query (Postgres).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SELECT query" },
      },
      required: ["query"],
    },
  },
  {
    name: "test_api_connections",
    description: "Test Stripe/HubSpot/CallGear connections.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "hubspot_control",
    description:
      "HubSpot Operations (Sync/Create). Use client_control for reading/health. Use this for SYNC.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["sync_now", "get_contacts", "create_task"], // Added create_task ideally, but existing is fine
        },
      },
      required: ["action"],
    },
  },

  // 9. THE TRUTH ENGINE (Data Reconciliation)
  {
    name: "marketing_truth_engine",
    description:
      "The source of truth for Ad Performance. Reconciles FB Spend vs. HubSpot Leads vs. AnyTrack Conversions. Returns TRUE ROAS.",
    input_schema: {
      type: "object",
      properties: {
        date_range: {
          type: "string",
          enum: ["this_month", "last_30d", "last_90d", "this_year", "all_time"],
          description: "Period to analyze",
        },
      },
      required: ["date_range"],
    },
  },
];

// WhatsApp Safe Tools
export const LISA_SAFE_TOOLS = new Set([
  "location_control",
  "hubspot_control",
  "client_control", // Maybe too dangerous? Masking needed.
]);
