/**
 * SMART PAUSE (Typing Emulation)
 *
 * Calculates a natural delay based on response length and complexity.
 * Prevents the "lnstant Robot Reply" effect.
 */

export function calculateSmartPause(text: string): number {
  const WORDS_PER_MINUTE = 300; // Fast typer, but human
  const BASE_LATENCY = 1500; // Network/Thinking time

  const wordCount = text.split(" ").length;
  const readingTime = (wordCount / WORDS_PER_MINUTE) * 60 * 1000;

  // Random jitter +/- 500ms
  const jitter = Math.floor(Math.random() * 1000) - 500;

  return Math.max(2000, BASE_LATENCY + readingTime + jitter);
}
