import { buildAgentPrompt } from "../supabase/functions/_shared/unified-prompts.ts";

// MOCK TRUTH DATA (What data-reconciler would return)
const mockTruthData = {
  financials: {
    ad_spend: 15420.5,
    attributed_revenue: 43500.0,
    organic_revenue: 12000.0,
    total_revenue: 55500.0,
  },
  intelligence: {
    true_roas: 2.82,
    reported_roas: 5.4, // FB lies
    roas_uplift_percent: -47.7,
    winning_campaigns: [
      {
        name: "DXB_Broad_Offer_Jan",
        revenue: 22000,
        deals: 15,
        spend: 5000,
        roos: 4.4,
      },
      {
        name: "Retargeting_Visit_Web",
        revenue: 8500,
        deals: 8,
        spend: 1200,
        roos: 7.08,
      },
      { name: "Zombie_Ad_Test_V2", revenue: 0, deals: 0, spend: 2500, roos: 0 },
    ],
  },
};

// MOCK LEARNING RULES
const learningRules = [
  {
    condition_pattern: "High Spend > $2000 & Zero Sales",
    action_pattern: "KILL IMMEDIATELY",
    confidence_score: 0.95,
  },
  {
    condition_pattern: "ROAS > 4.0 & Spend < $2000",
    action_pattern: "SCALE BUDGET 20%",
    confidence_score: 0.88,
  },
];

async function runSimulation() {
  console.log("🚀 STARTING AD CREATIVE ANALYST SIMULATION...\n");

  // 1. Build Persona
  const systemPrompt = buildAgentPrompt("AD_CREATIVE_ANALYST", {
    includeROI: true,
    worldKnowledge: {
      time: new Date().toISOString(),
      businessHours: "14:00 (Business Hours)",
    },
  });

  console.log("🤖 AGENT PERSONA ACTIVATED:");
  console.log(systemPrompt.substring(0, 200) + "...\n");

  // 2. Format Context
  const learningContext = learningRules
    .map(
      (r) => `- Pattern: ${r.condition_pattern} => Action: ${r.action_pattern}`,
    )
    .join("\n");

  const userPrompt = `
      HERE IS THE TRUTH ENGINE DATA FOR LAST_30D:
      
      HISTORICAL LEARNINGS (APPLY THESE):
      ${learningContext}
      
      FINANCIALS:
      - Ad Spend: ${mockTruthData.financials.ad_spend}
      - Attributed Revenue: ${mockTruthData.financials.attributed_revenue}
      - TRUE ROAS: ${mockTruthData.intelligence.true_roas.toFixed(2)}
      
      CAMPAIGN PERFORMANCE:
      ${JSON.stringify(mockTruthData.intelligence.winning_campaigns, null, 2)}
      
      YOUR TASK:
      1. Analyze the creative performance based on TRUE ROAS.
      2. Identify "Zombie Ads" and "Hidden Gems".
      3. Provide a bulleted "Kill/Scale" strategy.
    `;

  console.log("📥 INPUT PROMPT:");
  console.log(userPrompt);

  console.log(
    "\n✅ SIMULATION COMPLETE. This prompt would be sent to Gemini Flash 2.0.",
  );
  console.log(
    "Expected Output: detection of 'Zombie_Ad_Test_V2' as a KILL target based on learning rule #1.",
  );
}

runSimulation();
