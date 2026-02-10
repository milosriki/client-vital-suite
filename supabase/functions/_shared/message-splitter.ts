/**
 * 💬 MESSAGE SPLITTER v1.0
 *
 * Splits a single AI response into 1-4 WhatsApp bubbles
 * at natural break points. This creates the feel of a real
 * person typing multiple messages instead of one big block.
 *
 * Design Principles:
 * - Short messages stay as 1 bubble
 * - Medium messages split at sentence boundaries
 * - Long messages split at paragraph/thought breaks
 * - Each bubble gets a typing delay based on word count
 * - Never splits mid-sentence
 */

export interface MessageBubble {
  text: string;
  delayMs: number; // typing delay BEFORE sending this bubble
}

export interface SplitOptions {
  maxBubbles?: number; // 1-4, default 4
  baseDelayMs?: number; // base delay per bubble, default 800
  msPerWord?: number; // additional ms per word, default 30
}

const DEFAULT_OPTIONS: Required<SplitOptions> = {
  maxBubbles: 4,
  baseDelayMs: 800,
  msPerWord: 30,
};

/**
 * Calculates typing delay for a bubble based on its word count
 */
function calculateBubbleDelay(
  text: string,
  baseDelayMs: number,
  msPerWord: number,
): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const typingTime = baseDelayMs + wordCount * msPerWord;

  // Add jitter: ±15% randomness
  const jitter = typingTime * (Math.random() * 0.3 - 0.15);

  return Math.round(Math.max(400, typingTime + jitter));
}

/**
 * Finds the best split points in a message.
 * Priority: paragraph breaks > double newline > sentence boundaries
 */
function findSplitPoints(text: string): string[] {
  // 1. Try paragraph breaks first (\n\n or \n)
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length >= 2) {
    return paragraphs;
  }

  // 2. Try newline breaks
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return lines;
  }

  // 3. Try sentence boundaries (. ! ?)
  // Split on sentence-ending punctuation followed by a space
  const sentences: string[] = [];
  let current = "";

  // Match sentence boundaries: period/!/? followed by space or end
  const parts = text.split(/(?<=[.!?])\s+/);

  for (const part of parts) {
    if (!current) {
      current = part;
    } else if ((current + " " + part).split(/\s+/).length <= 25) {
      // Combine short sentences into one chunk (max ~25 words per chunk)
      current = current + " " + part;
    } else {
      sentences.push(current.trim());
      current = part;
    }
  }
  if (current.trim()) {
    sentences.push(current.trim());
  }

  if (sentences.length >= 2) {
    return sentences;
  }

  // 4. Fallback: return as single chunk
  return [text.trim()];
}

/**
 * Merges small chunks together to avoid sending tiny 1-2 word bubbles.
 * Minimum 3 words per bubble.
 */
function mergeSmallChunks(chunks: string[]): string[] {
  const MIN_WORDS = 3;
  const merged: string[] = [];

  for (const chunk of chunks) {
    const wordCount = chunk.split(/\s+/).filter(Boolean).length;

    if (
      merged.length > 0 &&
      wordCount < MIN_WORDS
    ) {
      // Merge with previous chunk
      merged[merged.length - 1] += "\n" + chunk;
    } else {
      merged.push(chunk);
    }
  }

  return merged;
}

/**
 * Trims the number of bubbles to maxBubbles by merging trailing chunks.
 */
function trimToMaxBubbles(chunks: string[], maxBubbles: number): string[] {
  if (chunks.length <= maxBubbles) return chunks;

  // Keep first (maxBubbles - 1) chunks, merge rest into last bubble
  const result = chunks.slice(0, maxBubbles - 1);
  const remaining = chunks.slice(maxBubbles - 1).join("\n");
  result.push(remaining);

  return result;
}

/**
 * Main splitter: takes a single AI response and returns 1-4 bubbles
 * with calculated typing delays.
 *
 * Usage:
 *   const bubbles = splitMessage("Hey! That's awesome.\nLet me check on that for you.");
 *   for (const bubble of bubbles) {
 *     await sleep(bubble.delayMs);
 *     await sendToAISensy(phone, bubble.text);
 *   }
 */
export function splitMessage(
  text: string,
  options: SplitOptions = {},
): MessageBubble[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const trimmed = text.trim();

  // Short messages (< 15 words): always 1 bubble
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 15) {
    return [
      {
        text: trimmed,
        delayMs: calculateBubbleDelay(trimmed, opts.baseDelayMs, opts.msPerWord),
      },
    ];
  }

  // Find natural split points
  let chunks = findSplitPoints(trimmed);

  // Merge tiny chunks
  chunks = mergeSmallChunks(chunks);

  // Trim to max bubbles
  chunks = trimToMaxBubbles(chunks, opts.maxBubbles);

  // Build bubbles with delays
  return chunks.map((chunk, index) => ({
    text: chunk.trim(),
    delayMs:
      index === 0
        ? 0 // First bubble has no delay (smart-pause already handled it)
        : calculateBubbleDelay(chunk, opts.baseDelayMs, opts.msPerWord),
  }));
}
