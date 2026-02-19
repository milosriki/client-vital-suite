// ================================================================
// File: supabase/functions/_shared/response-parser.ts
// Parses the LLM output into thought + reply
// ================================================================

import { InternalThought } from "./smart-prompt.ts";

export interface ParsedResponse {
  thought: InternalThought | null;
  reply: string;
  raw: string;
}

export function parseAIResponse(raw: string): ParsedResponse {
  let thought: InternalThought | null = null;
  let reply = "";

  // Extract internal monologue
  const thoughtMatch = raw.match(/---THOUGHT_START---([\s\S]*?)---THOUGHT_END---/);
  if (thoughtMatch) {
    try {
      const cleaned = thoughtMatch[1].trim();
      thought = JSON.parse(cleaned) as InternalThought;
    } catch (e) {
      console.error("Failed to parse internal thought:", e);
    }
  }

  // Extract visible reply
  const replyMatch = raw.match(/---REPLY_START---([\s\S]*?)---REPLY_END---/);
  if (replyMatch) {
    reply = replyMatch[1].trim();
  } else {
    // Fallback: if the model didn't follow format, use the whole thing
    // but strip the thought block if present
    reply = raw
      .replace(/---THOUGHT_START---[\s\S]*?---THOUGHT_END---/, "")
      .trim();
  }

  // Safety: ensure reply isn't empty
  if (!reply) {
    reply =
      "Hey! Lisa here. Glad you reached out. What's the main goal we're looking at?";
  }

  // Smart truncation: 200-word safety net at sentence boundaries
  // (replaces old 80-word hard chop that killed naturalness)
  const words = reply.split(/\s+/);
  if (words.length > 200) {
    // Find last sentence boundary before 200 words
    const truncated = words.slice(0, 200).join(" ");
    const lastSentence = truncated.search(/[.!?]\s[^.!?]*$/);
    if (lastSentence > 0) {
      reply = truncated.slice(0, lastSentence + 1).trim();
    } else {
      reply = truncated.trim();
    }
  }

  return { thought, reply, raw };
}
