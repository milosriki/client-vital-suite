import { SalesStrategy } from "../supabase/functions/_shared/sales-strategy.ts";
import {
  AvatarLogic,
  DubaiContext,
} from "../supabase/functions/_shared/avatar-logic.ts";
import { WHATSAPP_SALES_PERSONA } from "../supabase/functions/_shared/whatsapp-sales-prompts.ts";

console.log("🏆 VERIFYING MARK PERSONA (Dubai Edition) 🏆\n");

// SCENARIO 1: Ninoshka (Mom, C-Section, Wants Brevity)
console.log("[Scenario 1] NINOSHKA (New Mom)");
const ninoshkaContext = {
  properties: {
    firstname: "Ninoshka",
    number_of_children: "1",
    tags: "postpartum",
    whatsapp_stage: "1_CONNECTION",
    city: "Dubai Marina", // Testing Context too
  },
};
const avatar1 = AvatarLogic.identify(ninoshkaContext);
const strategy1 = SalesStrategy.getStrategy("1_CONNECTION", ninoshkaContext);
const context1 = DubaiContext.getContext(ninoshkaContext.properties.city);

console.log(`Avatar: ${avatar1} (Expected: MOMS)`);
console.log(`Region: ${ninoshkaContext.properties.city}`);
console.log(`Strategy: \n${strategy1}`);
console.log(`Context Injection: \n${context1}`);
console.log("---------------------------------------------------\n");

// SCENARIO 2: Uzma (Confused about Free)
console.log("[Scenario 2] UZMA (Objection Handling)");
const uzmaContext = {
  properties: {
    firstname: "Uzma",
    whatsapp_stage: "OBJECTION",
  },
};
const strategy2 = SalesStrategy.getStrategy("OBJECTION", uzmaContext);
console.log(`Strategy Move: \n${strategy2}`);
console.log("---------------------------------------------------\n");

// SCENARIO 3: Taleana (Price Gatekeeper)
console.log("[Scenario 3] TALEANA (Price Question)");
// This is more handled by the Knowledge Base via Dialogflow, but we test the prompt constraints here.
console.log("Checking Pricing Constraints in Prompt:");
if (
  WHATSAPP_SALES_PERSONA.includes("289 AED") &&
  WHATSAPP_SALES_PERSONA.includes("Never lead with price")
) {
  console.log("✅ Pricing Rules Found in System Persona.");
} else {
  console.log("❌ Pricing Rules MISSING.");
}

console.log("---------------------------------------------------\n");
console.log(
  "✅ Simulation Complete. Ensure outputs match 'Optimized Rewrites'.",
);
