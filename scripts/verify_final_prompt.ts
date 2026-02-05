import { WHATSAPP_SALES_PERSONA } from "../supabase/functions/_shared/whatsapp-sales-prompts.ts";
import { AvatarLogic } from "../supabase/functions/_shared/avatar-logic.ts";

// Mock HubSpot Context for a "Mom"
const MOCK_CONTEXT = {
  properties: {
    firstname: "Sarah",
    gender: "female",
    number_of_children: "2",
    whatsapp_stage: "1_CONNECTION",
    fitness_goal: "Lose baby weight",
  },
};

const CURRENT_GOAL = "Validation";

function buildDynamicPersona(hubspotData: any, currentGoal: string) {
  const contactName = hubspotData?.properties?.firstname || "Friend";
  const stage = hubspotData?.properties?.whatsapp_stage || "Discovery";

  const avatarType = AvatarLogic.identify(hubspotData);
  const avatarInstruction = AvatarLogic.getInstruction(avatarType);

  return `
${WHATSAPP_SALES_PERSONA}

=== DYNAMIC SALES INTELLIGENCE ===
${avatarInstruction}

Current Lead Context:
- Name: ${contactName}
- AVATAR SEGMENT: ${avatarType}
- Current Stage: ${stage}
- Goal: ${hubspotData?.properties?.fitness_goal || "Unknown"}

IMPORTANT: You are talking to ${contactName}.
CURRENT GOAL: ${currentGoal} (This is your ONLY focus).
Drive towards the assessment using the goal above. Be casual and concise.
`;
}

console.log("=== FINAL SYSTEM PROMPT GENERATED ===\n");
console.log(buildDynamicPersona(MOCK_CONTEXT, CURRENT_GOAL));
console.log("\n=====================================");
console.log(
  "✅ Verification: Check if 'Moms' tone and 'No Scarcity' rules are present.",
);
