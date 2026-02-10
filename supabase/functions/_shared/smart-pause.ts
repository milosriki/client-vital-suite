/**
 * SMART PAUSE v2.0 — Typing Emulation Engine
 *
 * Calculates a natural delay before the FIRST bubble is sent.
 * This simulates Lisa "reading the message and thinking" before replying.
 *
 * After this initial pause, inter-bubble delays are handled by
 * the message-splitter (per-bubble typing simulation).
 *
 * Factors:
 * 1. Word count of incoming message (reading time)
 * 2. Word count of response (composing time)
 * 3. Question detection (+500ms — thinking before answering)
 * 4. Emoji/casual detection (-200ms — quick casual reply)
 * 5. Random jitter ±20% for human variance
 * 6. Hard floor: 1200ms, hard ceiling: 6000ms
 */

// Typing speed constants
const READ_WPM = 400; // How fast Lisa "reads" the incoming message
const TYPE_WPM = 200; // How fast Lisa "types" her reply
const BASE_THINK_MS = 800; // Base "thinking" latency

// Adjustments
const QUESTION_BONUS_MS = 500; // Extra pause when answering a question
const CASUAL_DISCOUNT_MS = 200; // Faster reply for casual/emoji messages
const LONG_MSG_BONUS_MS = 300; // Extra time for longer incoming messages

// Bounds
const FLOOR_MS = 1200;
const CEILING_MS = 6000;

/**
 * Detects if the incoming message contains a question
 */
function hasQuestion(text: string): boolean {
  return /\?/.test(text) || /^(what|how|when|where|why|who|which|can|do|does|is|are|will|would|should|could)\b/i.test(text.trim());
}

/**
 * Detects casual/emoji-heavy messages that warrant faster replies
 */
function isCasualMessage(text: string): boolean {
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  // Casual if: lots of emojis relative to words, or very short
  return emojiCount >= 2 || wordCount <= 3;
}

/**
 * Calculates a human-like pause before the first reply bubble.
 *
 * @param incomingText - The user's message (Lisa "reads" this)
 * @param responseText - Lisa's reply (she "types" this) — optional, defaults to incoming
 */
export function calculateSmartPause(
  incomingText: string,
  responseText?: string,
): number {
  const incoming = incomingText || "";
  const response = responseText || incoming;

  const incomingWords = incoming.split(/\s+/).filter(Boolean).length;
  const responseWords = response.split(/\s+/).filter(Boolean).length;

  // 1. Reading time — how long to read the incoming message
  const readMs = (incomingWords / READ_WPM) * 60 * 1000;

  // 2. Composing time — how long to type the first bubble
  const typeMs = (Math.min(responseWords, 20) / TYPE_WPM) * 60 * 1000;

  // 3. Base calculation
  let totalMs = BASE_THINK_MS + readMs + typeMs;

  // 4. Question bonus — need time to "think"
  if (hasQuestion(incoming)) {
    totalMs += QUESTION_BONUS_MS;
  }

  // 5. Casual discount — quick casual replies feel natural
  if (isCasualMessage(incoming)) {
    totalMs -= CASUAL_DISCOUNT_MS;
  }

  // 6. Long message bonus — reading a wall of text takes time
  if (incomingWords > 30) {
    totalMs += LONG_MSG_BONUS_MS;
  }

  // 7. Random jitter ±20%
  const jitter = totalMs * (Math.random() * 0.4 - 0.2);
  totalMs += jitter;

  // 8. Clamp to bounds
  return Math.round(Math.max(FLOOR_MS, Math.min(CEILING_MS, totalMs)));
}
