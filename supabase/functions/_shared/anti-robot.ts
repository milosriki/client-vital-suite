/**
 * ANTI-ROBOT SYNTAX ENGINE
 *
 * Goal: Remove "Perfect Grammar" markers that signal AI.
 * - Lowercase first letters occasionally.
 * - Remove periods from short texts.
 * - Add "softeners" (haha, lol, honestly) if mood aligns.
 */

export const AntiRobot = {
  humanize(
    text: string,
    mood: "PROFESSIONAL" | "CASUAL" = "PROFESSIONAL",
  ): string {
    let output = text;

    // 1. Remove period from short messages (<10 words)
    if (output.split(" ").length < 10 && output.endsWith(".")) {
      output = output.slice(0, -1);
    }

    // 2. Casual Mode: Lowercase start (15% chance)
    if (mood === "CASUAL" && Math.random() < 0.15) {
      output = output.charAt(0).toLowerCase() + output.slice(1);
    }

    // 3. Contractions Force (Do not -> Don't)
    output = output.replace(/do not/gi, "don't");
    output = output.replace(/cannot/gi, "can't");
    output = output.replace(/will not/gi, "won't");
    output = output.replace(/I am/gi, "I'm");

    return output;
  },
};
