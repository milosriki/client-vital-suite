// Unified Prompt Builder
// Combines all prompt components into unified prompts for agents

import { PTD_BASE_KNOWLEDGE, ANTI_HALLUCINATION_RULES, CHAIN_OF_THOUGHT_REASONING, TOOL_USAGE_STRATEGY, HUBSPOT_MAPPINGS } from './prompt-library';
import { LEAD_LIFECYCLE_PROMPT } from './lead-lifecycle-mapping';
import { LEAD_LIFECYCLE_ADDITIONAL_PROMPT } from './prompts/lead-lifecycle';
import { UNIFIED_SCHEMA_PROMPT } from './unified-data-schema';
import { ULTIMATE_TRUTH_PROMPT } from './prompts/ultimate-truth';
import { ROI_MANAGERIAL_PROMPT } from './prompts/roi-managerial';
import { AGENT_ALIGNMENT_PROMPT } from './prompts/agent-alignment';
import { HUBSPOT_WORKFLOWS_PROMPT } from './prompts/hubspot-workflows';

export interface PromptBuilderOptions {
  agentType: 'claude' | 'gemini' | 'specialized';
  includeLifecycle?: boolean;
  includeUltimateTruth?: boolean;
  includeWorkflows?: boolean;
  includeROI?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  knowledge?: string; // RAG knowledge from database
  memory?: string; // Past conversation memory
  tools?: string; // Available tools description
}

export function buildUnifiedPrompt(options: PromptBuilderOptions): string {
  const {
    agentType,
    includeLifecycle = true,
    includeUltimateTruth = true,
    includeWorkflows = true,
    includeROI = true,
    includeMemory = true,
    includeTools = true,
    knowledge = '',
    memory = '',
    tools = '',
  } = options;

  let prompt = '';

  // Base System Prompt
  prompt += `# PTD FITNESS SUPER-INTELLIGENCE AGENT v5.0 (Unified Prompt System)\n\n`;
  prompt += `## MISSION\n`;
  prompt += `You are the CENTRAL NERVOUS SYSTEM of PTD Fitness. You observe, analyze, predict, and control the entire business.\n\n`;

  // Anti-Hallucination Rules (Always included)
  prompt += `${ANTI_HALLUCINATION_RULES}\n\n`;

  // Chain-of-Thought Reasoning (For Gemini, always included)
  if (agentType === 'gemini') {
    prompt += `${CHAIN_OF_THOUGHT_REASONING}\n\n`;
  }

  // Tool Usage Strategy (If tools are available)
  if (includeTools && tools) {
    prompt += `${TOOL_USAGE_STRATEGY}\n\n`;
  }

  // Base Knowledge
  prompt += `${PTD_BASE_KNOWLEDGE}\n\n`;

  // Lead Lifecycle Knowledge
  if (includeLifecycle) {
    prompt += `${LEAD_LIFECYCLE_PROMPT}\n\n`;
    prompt += `${LEAD_LIFECYCLE_ADDITIONAL_PROMPT}\n\n`;
  }

  // Unified Data Schema
  prompt += `${UNIFIED_SCHEMA_PROMPT}\n\n`;

  // Agent Alignment Rules
  prompt += `${AGENT_ALIGNMENT_PROMPT}\n\n`;

  // Ultimate Truth Alignment
  if (includeUltimateTruth) {
    prompt += `${ULTIMATE_TRUTH_PROMPT}\n\n`;
  }

  // ROI & Managerial Intelligence
  if (includeROI) {
    prompt += `${ROI_MANAGERIAL_PROMPT}\n\n`;
  }

  // HubSpot Workflow Intelligence
  if (includeWorkflows) {
    prompt += `${HUBSPOT_WORKFLOWS_PROMPT}\n\n`;
  }

  // HubSpot Mappings
  prompt += `${HUBSPOT_MAPPINGS}\n\n`;

  // RAG Knowledge (Dynamic from database)
  if (knowledge) {
    prompt += `=== UPLOADED KNOWLEDGE DOCUMENTS (RAG) ===\n${knowledge}\n\n`;
  }

  // Memory (Past conversations)
  if (includeMemory && memory) {
    prompt += `=== MEMORY FROM PAST CONVERSATIONS ===\n${memory}\n\n`;
  }

  // Available Tools
  if (includeTools && tools) {
    prompt += `=== AVAILABLE TOOLS ===\n${tools}\n\n`;
  }

  // Provider-Specific Instructions
  if (agentType === 'claude') {
    prompt += `=== CLAUDE-SPECIFIC INSTRUCTIONS ===\n`;
    prompt += `- Use structured reasoning for complex queries\n`;
    prompt += `- Provide detailed analysis with citations\n`;
    prompt += `- Always calculate ROI for recommendations\n`;
    prompt += `- Use maximum context window (no token limits)\n\n`;
  } else if (agentType === 'gemini') {
    prompt += `=== GEMINI-SPECIFIC INSTRUCTIONS ===\n`;
    prompt += `- ALWAYS use chain-of-thought reasoning (5 steps)\n`;
    prompt += `- NEVER ask for clarification - use tools with available data\n`;
    prompt += `- Use universal_search FIRST for any lookup\n`;
    prompt += `- Show reasoning steps in response\n`;
    prompt += `- Be proactive and try multiple approaches\n\n`;
  }

  // Final Instructions
  prompt += `=== MANDATORY INSTRUCTIONS ===\n`;
  prompt += `1. ALWAYS query LIVE data from Supabase tables - NEVER use cached, mock, or test data\n`;
  prompt += `2. Use unified data schema for consistent field names\n`;
  prompt += `3. When data conflicts, use priority rules (AnyTrack > HubSpot > Facebook for attribution)\n`;
  prompt += `4. Calculate ROI for every recommendation\n`;
  prompt += `5. Quantify impact in AED\n`;
  prompt += `6. Cite sources with timestamps for every number\n`;
  prompt += `7. Use formatDealStage() and formatLifecycleStage() to convert IDs to names\n`;
  prompt += `8. Check long_cycle_protection view before closing leads\n`;
  prompt += `9. Prioritize by Contribution Margin, not just revenue\n`;
  prompt += `10. Consider $40K/month ad spend context in all recommendations\n`;

  return prompt;
}

// Convenience functions for common prompt types
export function buildClaudePrompt(options: Omit<PromptBuilderOptions, 'agentType'>): string {
  return buildUnifiedPrompt({ ...options, agentType: 'claude' });
}

export function buildGeminiPrompt(options: Omit<PromptBuilderOptions, 'agentType'>): string {
  return buildUnifiedPrompt({ ...options, agentType: 'gemini' });
}

export function buildSpecializedPrompt(
  specialization: 'churn' | 'intervention' | 'lead-reply' | 'bi',
  options: Omit<PromptBuilderOptions, 'agentType'>
): string {
  const specializedKnowledge = {
    churn: 'Focus on churn prediction, risk factors, and retention strategies.',
    intervention: 'Focus on intervention types, timing, and success probability.',
    'lead-reply': 'Focus on generating personalized SMS replies for leads.',
    bi: 'Focus on business intelligence, metrics, and executive reporting.',
  };

  return buildUnifiedPrompt({
    ...options,
    agentType: 'specialized',
    knowledge: specializedKnowledge[specialization] + '\n\n' + (options.knowledge || ''),
  });
}
