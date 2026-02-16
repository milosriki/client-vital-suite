import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  CONSTITUTIONAL_PRINCIPLES,
  getConstitutionalSystemMessage,
} from "./constitutional-framing.ts";

// ============================================================================
// CONSTITUTIONAL FRAMING TESTS
// Ensures all AI agents follow constitutional principles
// ============================================================================

Deno.test("CONSTITUTIONAL_PRINCIPLES - has all required principles", () => {
  // Verify all required principles exist
  assertEquals(typeof CONSTITUTIONAL_PRINCIPLES.SAFETY, "object", "SAFETY principle must exist");
  assertEquals(typeof CONSTITUTIONAL_PRINCIPLES.TRUTH, "object", "TRUTH principle must exist");
  assertEquals(typeof CONSTITUTIONAL_PRINCIPLES.CITATION, "object", "CITATION principle must exist");
  assertEquals(typeof CONSTITUTIONAL_PRINCIPLES.UNCERTAINTY, "object", "UNCERTAINTY principle must exist");
  assertEquals(typeof CONSTITUTIONAL_PRINCIPLES.PERSONA, "object", "PERSONA principle must exist");
});

Deno.test("CONSTITUTIONAL_PRINCIPLES - SAFETY has required fields", () => {
  const safety = CONSTITUTIONAL_PRINCIPLES.SAFETY;
  assertEquals(typeof safety.rule, "string", "SAFETY must have rule");
  assertEquals(typeof safety.enforcement, "string", "SAFETY must have enforcement");
  assertStringIncludes(safety.rule.toLowerCase(), "medical", "SAFETY rule must mention medical advice");
  assertStringIncludes(safety.enforcement.toLowerCase(), "specialist", "SAFETY enforcement must mention specialist");
});

Deno.test("CONSTITUTIONAL_PRINCIPLES - TRUTH has no hallucination guidance", () => {
  const truth = CONSTITUTIONAL_PRINCIPLES.TRUTH;
  assertEquals(typeof truth.rule, "string", "TRUTH must have rule");
  assertEquals(typeof truth.enforcement, "string", "TRUTH must have enforcement");
  assertStringIncludes(truth.rule.toLowerCase(), "hallucinate", "TRUTH rule must prohibit hallucination");
  assertStringIncludes(truth.rule.toLowerCase(), "data unavailable", "TRUTH rule must handle missing data");
  assertStringIncludes(truth.enforcement.toLowerCase(), "fabricate", "TRUTH enforcement must prohibit fabrication");
});

Deno.test("CONSTITUTIONAL_PRINCIPLES - CITATION requires data sources", () => {
  const citation = CONSTITUTIONAL_PRINCIPLES.CITATION;
  assertEquals(typeof citation.rule, "string", "CITATION must have rule");
  assertEquals(typeof citation.enforcement, "string", "CITATION must have enforcement");
  assertStringIncludes(citation.rule.toLowerCase(), "cite", "CITATION rule must require citing sources");
  assertStringIncludes(citation.rule.toLowerCase(), "source", "CITATION rule must mention data sources");
  assertStringIncludes(citation.enforcement.toLowerCase(), "table", "CITATION enforcement must mention tables/APIs/sources");
});

Deno.test("CONSTITUTIONAL_PRINCIPLES - UNCERTAINTY admits unknowns", () => {
  const uncertainty = CONSTITUTIONAL_PRINCIPLES.UNCERTAINTY;
  assertEquals(typeof uncertainty.rule, "string", "UNCERTAINTY must have rule");
  assertEquals(typeof uncertainty.enforcement, "string", "UNCERTAINTY must have enforcement");
  assertStringIncludes(uncertainty.rule.toLowerCase(), "admit", "UNCERTAINTY rule must admit uncertainty");
  assertStringIncludes(uncertainty.rule.toLowerCase(), "incomplete", "UNCERTAINTY rule must handle incomplete data");
  assertStringIncludes(uncertainty.enforcement.toLowerCase(), "based on available", "UNCERTAINTY enforcement must use hedging language");
});

Deno.test("CONSTITUTIONAL_PRINCIPLES - PERSONA maintains Lisa character", () => {
  const persona = CONSTITUTIONAL_PRINCIPLES.PERSONA;
  assertEquals(typeof persona.rule, "string", "PERSONA must have rule");
  assertEquals(typeof persona.enforcement, "string", "PERSONA must have enforcement");
  assertStringIncludes(persona.rule.toLowerCase(), "lisa", "PERSONA rule must mention Lisa");
  assertStringIncludes(persona.enforcement.toLowerCase(), "generic ai", "PERSONA enforcement must avoid generic AI phrases");
});

Deno.test("getConstitutionalSystemMessage - returns formatted string", () => {
  const message = getConstitutionalSystemMessage();
  assertEquals(typeof message, "string", "Must return a string");
  assertStringIncludes(message, "CONSTITUTIONAL GUARDRAILS", "Must include header");
  assertStringIncludes(message, "MUST FOLLOW", "Must emphasize requirement");
});

Deno.test("getConstitutionalSystemMessage - includes all 5 principles", () => {
  const message = getConstitutionalSystemMessage();

  // Check for all principles
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.SAFETY.rule, "Must include SAFETY rule");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.TRUTH.rule, "Must include TRUTH rule");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.CITATION.rule, "Must include CITATION rule");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.UNCERTAINTY.rule, "Must include UNCERTAINTY rule");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.PERSONA.rule, "Must include PERSONA rule");
});

Deno.test("getConstitutionalSystemMessage - includes all enforcements", () => {
  const message = getConstitutionalSystemMessage();

  // Check for enforcement guidelines
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.SAFETY.enforcement, "Must include SAFETY enforcement");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.TRUTH.enforcement, "Must include TRUTH enforcement");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.CITATION.enforcement, "Must include CITATION enforcement");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.UNCERTAINTY.enforcement, "Must include UNCERTAINTY enforcement");
  assertStringIncludes(message, CONSTITUTIONAL_PRINCIPLES.PERSONA.enforcement, "Must include PERSONA enforcement");
});

Deno.test("getConstitutionalSystemMessage - numbered list format", () => {
  const message = getConstitutionalSystemMessage();

  // Check for numbered list
  assertStringIncludes(message, "1. **", "Must have item 1");
  assertStringIncludes(message, "2. **", "Must have item 2");
  assertStringIncludes(message, "3. **", "Must have item 3");
  assertStringIncludes(message, "4. **", "Must have item 4");
  assertStringIncludes(message, "5. **", "Must have item 5");
});

Deno.test("Constitutional message - prevents medical advice", () => {
  const message = getConstitutionalSystemMessage();
  assertStringIncludes(message.toLowerCase(), "medical advice", "Must prohibit medical advice");
  assertStringIncludes(message.toLowerCase(), "specialist", "Must redirect to specialists");
});

Deno.test("Constitutional message - prevents ROI guarantees", () => {
  const message = getConstitutionalSystemMessage();
  assertStringIncludes(message.toLowerCase(), "roi", "Must mention ROI");
  assertStringIncludes(message.toLowerCase(), "guarantee", "Must prohibit guarantees");
  assertStringIncludes(message.toLowerCase(), "past performance", "Must include past performance disclaimer");
});

Deno.test("Constitutional message - handles NULL/undefined data", () => {
  const message = getConstitutionalSystemMessage();
  assertStringIncludes(message.toLowerCase(), "null", "Must handle NULL data");
  assertStringIncludes(message.toLowerCase(), "undefined", "Must handle undefined data");
  assertStringIncludes(message.toLowerCase(), "data unavailable", "Must use 'Data Unavailable' for missing data");
});

Deno.test("Constitutional message - no generic AI phrases", () => {
  const message = getConstitutionalSystemMessage();
  assertStringIncludes(message.toLowerCase(), "hope this email finds you well", "Must prohibit generic greeting");
  assertStringIncludes(message.toLowerCase(), "direct and warm", "Must encourage direct communication");
});

Deno.test("Constitutional message - is concise (< 2000 chars)", () => {
  const message = getConstitutionalSystemMessage();
  assertEquals(message.length < 2000, true, `Message too long: ${message.length} chars (should be < 2000)`);
});

Deno.test("Constitutional message - contains emoji marker", () => {
  const message = getConstitutionalSystemMessage();
  assertStringIncludes(message, "🛡️", "Should include shield emoji for visual recognition");
});
