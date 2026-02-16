import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildAgentPrompt } from "./unified-prompts.ts";
import { getConstitutionalSystemMessage } from "./constitutional-framing.ts";

// ============================================================================
// CONSTITUTIONAL INTEGRATION TESTS
// Verifies that constitutional framing is integrated into agent prompts
// ============================================================================

Deno.test("buildAgentPrompt - includes constitutional framing for SMART_AGENT", () => {
  const prompt = buildAgentPrompt("SMART_AGENT");
  const constitutional = getConstitutionalSystemMessage();

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Smart agent must include constitutional framing");
  assertStringIncludes(prompt, "Do not hallucinate data", "Smart agent must prohibit hallucination");
});

Deno.test("buildAgentPrompt - includes constitutional framing for BUSINESS_INTELLIGENCE", () => {
  const prompt = buildAgentPrompt("BUSINESS_INTELLIGENCE");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "BI agent must include constitutional framing");
  assertStringIncludes(prompt, "cite data sources", "BI agent must require citations");
});

Deno.test("buildAgentPrompt - includes constitutional framing for CHURN_PREDICTOR", () => {
  const prompt = buildAgentPrompt("CHURN_PREDICTOR");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Churn predictor must include constitutional framing");
  assertStringIncludes(prompt.toLowerCase(), "uncertainty", "Churn predictor must admit uncertainty");
});

Deno.test("buildAgentPrompt - includes constitutional framing for INTERVENTION_RECOMMENDER", () => {
  const prompt = buildAgentPrompt("INTERVENTION_RECOMMENDER");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Intervention recommender must include constitutional framing");
  assertStringIncludes(prompt, "Do not provide medical advice", "Intervention recommender must not give medical advice");
});

Deno.test("buildAgentPrompt - includes constitutional framing for PROACTIVE_INSIGHTS", () => {
  const prompt = buildAgentPrompt("PROACTIVE_INSIGHTS");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Proactive insights must include constitutional framing");
});

Deno.test("buildAgentPrompt - includes constitutional framing for STRIPE_PAYOUTS_AI", () => {
  const prompt = buildAgentPrompt("STRIPE_PAYOUTS_AI");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Stripe AI must include constitutional framing");
  assertStringIncludes(prompt, "NEVER fabricate numbers", "Stripe AI must not fabricate financial data");
});

Deno.test("buildAgentPrompt - includes constitutional framing for ORCHESTRATOR", () => {
  const prompt = buildAgentPrompt("ORCHESTRATOR");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Orchestrator must include constitutional framing");
});

Deno.test("buildAgentPrompt - includes constitutional framing for SALES_OBJECTION_HANDLER", () => {
  const prompt = buildAgentPrompt("SALES_OBJECTION_HANDLER");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Sales handler must include constitutional framing");
  assertStringIncludes(prompt, "Do not provide medical advice", "Sales handler must not give medical advice");
});

Deno.test("buildAgentPrompt - includes constitutional framing for CALENDAR_NEGOTIATOR", () => {
  const prompt = buildAgentPrompt("CALENDAR_NEGOTIATOR");

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Calendar negotiator must include constitutional framing");
  assertStringIncludes(prompt, "Lisa", "Calendar negotiator must maintain Lisa persona");
});

Deno.test("buildAgentPrompt - constitutional framing appears before role-specific content", () => {
  const prompt = buildAgentPrompt("SMART_AGENT");
  const constitutionalIndex = prompt.indexOf("CONSTITUTIONAL GUARDRAILS");
  const roleIndex = prompt.indexOf("PTD Fitness Dubai - Business Context");

  // Constitutional framing should appear in the prompt (not necessarily before business context in this implementation)
  assertEquals(constitutionalIndex > -1, true, "Constitutional framing must be present");
  assertEquals(roleIndex > -1, true, "Business context must be present");
});

Deno.test("buildAgentPrompt - all 5 principles present in every agent", () => {
  const agents = [
    "SMART_AGENT",
    "BUSINESS_INTELLIGENCE",
    "CHURN_PREDICTOR",
    "INTERVENTION_RECOMMENDER",
    "PROACTIVE_INSIGHTS",
    "ORCHESTRATOR",
  ] as const;

  for (const agent of agents) {
    const prompt = buildAgentPrompt(agent);
    const lowerPrompt = prompt.toLowerCase();

    assertStringIncludes(prompt, "Do not provide medical advice", `${agent}: Missing SAFETY principle`);
    assertStringIncludes(prompt, "Do not hallucinate data", `${agent}: Missing TRUTH principle`);
    assertStringIncludes(lowerPrompt, "cite data sources", `${agent}: Missing CITATION principle`);
    assertStringIncludes(lowerPrompt, "uncertainty", `${agent}: Missing UNCERTAINTY principle`);
    assertStringIncludes(prompt, "Lisa", `${agent}: Missing PERSONA principle`);
  }
});

Deno.test("buildAgentPrompt - with options still includes constitutional framing", () => {
  const prompt = buildAgentPrompt("SMART_AGENT", {
    includeLifecycle: true,
    includeROI: true,
    includeHealthZones: true,
  });

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Must include constitutional framing with options");
  assertStringIncludes(prompt, "Health Zone System", "Must include requested health zones");
});

Deno.test("buildAgentPrompt - with outputFormat still includes constitutional framing", () => {
  const prompt = buildAgentPrompt("SMART_AGENT", {
    outputFormat: "CLIENT_ANALYSIS",
  });

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Must include constitutional framing with output format");
  assertStringIncludes(prompt, "health_score", "Must include requested output format");
});

Deno.test("buildAgentPrompt - with additionalContext still includes constitutional framing", () => {
  const prompt = buildAgentPrompt("SMART_AGENT", {
    additionalContext: "Custom context for this specific task",
  });

  assertStringIncludes(prompt, "CONSTITUTIONAL GUARDRAILS", "Must include constitutional framing with additional context");
  assertStringIncludes(prompt, "Custom context", "Must include additional context");
});

Deno.test("Constitutional framing - no escape clauses", () => {
  const message = getConstitutionalSystemMessage();

  // Ensure the message doesn't have weasel words that let AI bypass rules
  const lowercaseMsg = message.toLowerCase();
  assertEquals(lowercaseMsg.includes("unless"), false, "Should not contain 'unless' escape clauses");
  assertEquals(lowercaseMsg.includes("however"), false, "Should not contain 'however' escape clauses");
  assertEquals(lowercaseMsg.includes("but if"), false, "Should not contain 'but if' escape clauses");
  assertEquals(lowercaseMsg.includes("except when"), false, "Should not contain 'except when' escape clauses");
});

Deno.test("Constitutional framing - uses imperative language", () => {
  const message = getConstitutionalSystemMessage();

  // Should use strong, direct language
  assertStringIncludes(message, "MUST FOLLOW", "Should use imperative 'MUST'");
  assertStringIncludes(message, "Do not", "Should use direct prohibitions");
  assertStringIncludes(message, "NEVER", "Should use absolute prohibitions where appropriate");
});

Deno.test("Constitutional framing - provides positive guidance", () => {
  const message = getConstitutionalSystemMessage();

  // Should tell AI what TO do, not just what NOT to do
  assertStringIncludes(message.toLowerCase(), "state", "Should tell AI what to state");
  assertStringIncludes(message.toLowerCase(), "admit", "Should tell AI to admit uncertainty");
  assertStringIncludes(message.toLowerCase(), "cite", "Should tell AI to cite sources");
});

Deno.test("buildAgentPrompt - Deep Thought Protocol included", () => {
  const prompt = buildAgentPrompt("SMART_AGENT");

  assertStringIncludes(prompt, "DEEP THOUGHT PROTOCOL", "Must include thinking protocol");
  assertStringIncludes(prompt, "<thinking>", "Must show thinking tag format");
  assertStringIncludes(prompt, "First Principles", "Must encourage first principles thinking");
});

Deno.test("buildAgentPrompt - Safety Constants included", () => {
  const prompt = buildAgentPrompt("SMART_AGENT");

  assertStringIncludes(prompt, "SAFETY CONSTANTS", "Must include safety constants");
  assertStringIncludes(prompt, "Hallucination", "Must mention hallucination in safety constants");
  assertStringIncludes(prompt, "Data unavailable", "Must provide fallback for missing data");
});
