import { SalesStrategy } from "../supabase/functions/_shared/sales-strategy.ts";
import { AvatarLogic } from "../supabase/functions/_shared/avatar-logic.ts";

console.log("🏆 VERIFYING ELITE SALES LOGIC (World Class Setter) 🏆\n");

// SCENARIO 1: The "Maybe" Lead (Qualify Stage)
console.log("[Scenario 1] Stage: 2_QUALIFY (Finding the Gap)");
const context1 = {
  properties: {
    firstname: "Mike",
    fitness_goal: "Gain Muscle",
    whatsapp_stage: "2_QUALIFY",
  },
};
const strategy1 = SalesStrategy.getStrategy("2_QUALIFY", context1);
console.log(`Expected: "Problem Extraction" | Actual:\n${strategy1}`);
console.log("---------------------------------------------------\n");

// SCENARIO 2: The "Ready" Lead (Closing Stage)
console.log("[Scenario 2] Stage: 4_CLOSING (Permission Close)");
const context2 = {
  properties: {
    firstname: "Sarah",
    fitness_goal: "Loose Weight",
    whatsapp_stage: "4_CLOSING",
  },
};
const strategy2 = SalesStrategy.getStrategy("4_CLOSING", context2);
console.log(`Expected: "Would you be opposed?" (Voss) | Actual:\n${strategy2}`);
console.log("---------------------------------------------------\n");

// SCENARIO 3: The "Too Expensive" Lead (Objection Stage)
console.log("[Scenario 3] Stage: OBJECTION (Diffusing)");
const context3 = {
  properties: {
    firstname: "John",
    whatsapp_stage: "OBJECTION",
  },
};
const strategy3 = SalesStrategy.getStrategy("OBJECTION", context3);
console.log(
  `Expected: "Aside from money..." (Isolation) | Actual:\n${strategy3}`,
);
console.log("---------------------------------------------------\n");

console.log(
  "✅ Verification Complete. Check if strategies match NEPQ/Voss frameworks.",
);
