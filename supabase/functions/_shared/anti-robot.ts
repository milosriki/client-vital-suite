/**
 * ANTI-ROBOT SYNTAX ENGINE v2.0
 *
 * 15 probability-based transforms that make AI text feel like
 * a real person typing on WhatsApp. Each transform fires based
 * on a random probability to create natural variation.
 *
 * Design: Every message gets a DIFFERENT subset of transforms,
 * so no two messages feel mechanically identical.
 */

// Common filler words real people use on WhatsApp
const FILLERS = ["honestly", "tbh", "like", "actually", "basically", "ngl"];

// Warm openers that real people start messages with
const WARM_OPENERS = [
  "oh nice",
  "ah ok",
  "haha ok",
  "ooh",
  "yess",
  "ah got it",
  "ohh",
  "nice",
];

// Casual closers real people end messages with
const CASUAL_CLOSERS = [
  "lmk!",
  "let me know 😊",
  "hmu when you're ready",
  "just lmk",
  "whenever works for you!",
  "no rush!",
];

// Common abbreviations real WhatsApp users type
const ABBREVIATION_MAP: Record<string, string> = {
  "going to": "gonna",
  "want to": "wanna",
  "got to": "gotta",
  "kind of": "kinda",
  "sort of": "sorta",
  "a lot of": "a lot of",
  "right now": "rn",
  "to be honest": "tbh",
  "in my opinion": "imo",
  "by the way": "btw",
  "for real": "fr",
};

// Formal phrases that scream "AI wrote this"
const FORMAL_REMOVALS: Record<string, string> = {
  "I would be happy to": "I can",
  "I'd be happy to": "I can",
  "That's a great question": "Good q",
  "Absolutely!": "Yeah!",
  "Certainly!": "Sure!",
  "I completely understand": "I get it",
  "I understand your concern": "I hear you",
  "Thank you for sharing that": "Thanks for that",
  "That's wonderful": "That's awesome",
  "I appreciate you": "Thanks",
  "Would you like me to": "Want me to",
  "Please don't hesitate": "Just",
  "I'm here to help": "",
  "Is there anything else": "Anything else",
  "Have a wonderful day": "Have a good one",
};

// Emojis that fit a fitness/wellness WhatsApp context
const CONTEXT_EMOJIS = ["💪", "🔥", "😊"];

export interface AntiRobotOptions {
  mood?: "PROFESSIONAL" | "CASUAL";
  userName?: string;
  messageIndex?: number; // which message in conversation (for escalating casualness)
}

export const AntiRobot = {
  humanize(
    text: string,
    moodOrOptions: "PROFESSIONAL" | "CASUAL" | AntiRobotOptions = "PROFESSIONAL",
  ): string {
    // Normalize options
    const opts: AntiRobotOptions =
      typeof moodOrOptions === "string"
        ? { mood: moodOrOptions }
        : moodOrOptions;

    const mood = opts.mood || "PROFESSIONAL";
    const casualFactor = mood === "CASUAL" ? 1.5 : 1.0;
    let output = text;

    // === TRANSFORM 1: Contraction Forcing ===
    // Probability: 95% — almost always fire
    if (Math.random() < 0.95) {
      output = output.replace(/\bdo not\b/gi, "don't");
      output = output.replace(/\bcannot\b/gi, "can't");
      output = output.replace(/\bwill not\b/gi, "won't");
      output = output.replace(/\bI am\b/g, "I'm"); // case-sensitive for "I am"
      output = output.replace(/\bI have\b/g, "I've");
      output = output.replace(/\bit is\b/gi, "it's");
      output = output.replace(/\bthat is\b/gi, "that's");
      output = output.replace(/\bthey are\b/gi, "they're");
      output = output.replace(/\bwe are\b/gi, "we're");
      output = output.replace(/\byou are\b/gi, "you're");
      output = output.replace(/\bwould not\b/gi, "wouldn't");
      output = output.replace(/\bcould not\b/gi, "couldn't");
      output = output.replace(/\bshould not\b/gi, "shouldn't");
      output = output.replace(/\blet us\b/gi, "let's");
    }

    // === TRANSFORM 2: Remove Trailing Period on Short Messages ===
    // Probability: 80%
    if (Math.random() < 0.8) {
      const wordCount = output.split(/\s+/).length;
      if (wordCount < 12 && output.endsWith(".")) {
        output = output.slice(0, -1);
      }
    }

    // === TRANSFORM 3: Lowercase First Letter ===
    // Probability: 25% (CASUAL) / 10% (PROFESSIONAL)
    if (Math.random() < 0.15 * casualFactor) {
      output = output.charAt(0).toLowerCase() + output.slice(1);
    }

    // === TRANSFORM 4: Filler Word Injection ===
    // Probability: 20% (CASUAL) / 8% (PROFESSIONAL)
    if (Math.random() < 0.12 * casualFactor) {
      const filler = FILLERS[Math.floor(Math.random() * FILLERS.length)];
      // Insert after first sentence or first comma
      const insertPoint = output.search(/[,.]/) + 1;
      if (insertPoint > 0 && insertPoint < output.length - 5) {
        output =
          output.slice(0, insertPoint) +
          " " + filler + " " +
          output.slice(insertPoint).trimStart();
      }
    }

    // === TRANSFORM 5: Warm Opener Injection ===
    // Probability: 15% — only at start of conversation-style messages
    if (Math.random() < 0.15 * casualFactor) {
      const opener =
        WARM_OPENERS[Math.floor(Math.random() * WARM_OPENERS.length)];
      // Only add if message doesn't already start casually
      if (!/^(hey|oh|ah|haha|yess|nice|ok|hmm)/i.test(output)) {
        output = opener + ", " + output.charAt(0).toLowerCase() + output.slice(1);
      }
    }

    // === TRANSFORM 6: Casual Closer ===
    // Probability: 12% — adds a casual sign-off
    if (Math.random() < 0.12 * casualFactor) {
      // Only if message ends with a question or call-to-action
      if (/[?!]$/.test(output.trim())) {
        // Don't double up
      } else {
        const closer =
          CASUAL_CLOSERS[Math.floor(Math.random() * CASUAL_CLOSERS.length)];
        output = output.trimEnd() + "\n" + closer;
      }
    }

    // === TRANSFORM 7: Emoji Injection ===
    // Probability: 20% (CASUAL) / 8% (PROFESSIONAL)
    if (Math.random() < 0.12 * casualFactor) {
      const emoji =
        CONTEXT_EMOJIS[Math.floor(Math.random() * CONTEXT_EMOJIS.length)];
      // Append to end of message
      if (!/[\u{1F300}-\u{1F9FF}]/u.test(output.slice(-3))) {
        output = output.trimEnd() + " " + emoji;
      }
    }

    // === TRANSFORM 8: Ellipsis ===
    // Probability: 10% — replace a period with "..."
    if (Math.random() < 0.1 * casualFactor) {
      // Replace first mid-sentence period with ellipsis
      const periodIdx = output.indexOf(". ");
      if (periodIdx > 10 && periodIdx < output.length - 20) {
        output =
          output.slice(0, periodIdx) + "..." + output.slice(periodIdx + 1);
      }
    }

    // === TRANSFORM 9: Double Exclamation ===
    // Probability: 15% — turn "!" into "!!"
    if (Math.random() < 0.15 * casualFactor) {
      // Only the first exclamation mark
      const excIdx = output.indexOf("!");
      if (excIdx > 0 && output[excIdx + 1] !== "!") {
        output = output.slice(0, excIdx) + "!!" + output.slice(excIdx + 1);
      }
    }

    // === TRANSFORM 10: Name Injection ===
    // Probability: 20% — if we have the user's name
    if (opts.userName && Math.random() < 0.2) {
      const firstName = opts.userName.split(" ")[0];
      // Prepend name at start if not already present
      if (!output.toLowerCase().includes(firstName.toLowerCase())) {
        output = firstName + ", " + output.charAt(0).toLowerCase() + output.slice(1);
      }
    }

    // === TRANSFORM 11: Subtle Typo Injection ===
    // Probability: 5% — very rare, just enough for authenticity
    if (Math.random() < 0.05) {
      // Simple transposition on a random word
      const words = output.split(" ");
      if (words.length > 5) {
        const idx = Math.floor(Math.random() * (words.length - 2)) + 1;
        const word = words[idx];
        if (word.length >= 4 && /^[a-zA-Z]+$/.test(word)) {
          // Swap two adjacent chars
          const charIdx = Math.floor(Math.random() * (word.length - 2)) + 1;
          const chars = word.split("");
          [chars[charIdx], chars[charIdx + 1]] = [
            chars[charIdx + 1],
            chars[charIdx],
          ];
          words[idx] = chars.join("");
          output = words.join(" ");
        }
      }
    }

    // === TRANSFORM 12: Abbreviation Injection ===
    // Probability: 25% (CASUAL) / 10% (PROFESSIONAL)
    if (Math.random() < 0.15 * casualFactor) {
      for (const [formal, abbrev] of Object.entries(ABBREVIATION_MAP)) {
        const regex = new RegExp(`\\b${formal}\\b`, "gi");
        if (regex.test(output)) {
          output = output.replace(regex, abbrev);
          break; // Only one abbreviation per message
        }
      }
    }

    // === TRANSFORM 13: Formal Phrase Removal ===
    // Probability: 90% — almost always strip AI-isms
    if (Math.random() < 0.9) {
      for (const [formal, casual] of Object.entries(FORMAL_REMOVALS)) {
        if (output.includes(formal)) {
          output = output.replace(formal, casual);
        }
      }
    }

    // === TRANSFORM 14: Sentence Fragment ===
    // Probability: 8% — break a long sentence into a fragment
    if (Math.random() < 0.08 * casualFactor) {
      const sentences = output.split(". ");
      if (sentences.length >= 2) {
        const longIdx = sentences.findIndex((s) => s.split(" ").length > 8);
        if (longIdx >= 0) {
          const words = sentences[longIdx].split(" ");
          const breakPoint = Math.floor(words.length * 0.6);
          sentences[longIdx] =
            words.slice(0, breakPoint).join(" ") +
            ".\n" +
            words.slice(breakPoint).join(" ");
          output = sentences.join(". ");
        }
      }
    }

    // === TRANSFORM 15: Paragraph Break Removal ===
    // Probability: 30% — WhatsApp users don't write formal paragraphs
    if (Math.random() < 0.3) {
      // Replace double newlines with single newline
      output = output.replace(/\n\n/g, "\n");
    }

    // Final cleanup: no double spaces, trim
    output = output.replace(/  +/g, " ").trim();

    return output;
  },
};
