/**
 * DOUBLE TEXT LOGIC (Re-engagement)
 *
 * Goal: Nudge users who ghosted without being annoying.
 * Rule: Only double text after 24 hours of silence.
 * Content: Context-aware value add (not just "checking in").
 */

export const DoubleTextLogic = {
  shouldDoubleText(
    lastMessageTime: string | null,
    lastSender: string,
  ): boolean {
    if (!lastMessageTime || lastSender === "user") return false;

    const last = new Date(lastMessageTime).getTime();
    const now = Date.now();
    const hoursSince = (now - last) / (1000 * 60 * 60);

    // Only nudge if it's been > 24 hours and < 48 hours
    return hoursSince > 24 && hoursSince < 48;
  },

  getNudge(stage: string): string {
    const nudges: Record<string, string> = {
      discovery:
        "Hey! Just wanted to send over a quick client success story that reminded me of your goal. Is now a bad time?",
      qualification:
        "Quick thought - if you're unsure about the timeline, we can start with a mini-plan. Thoughts?",
      booking:
        "I still have that slot open for tomorrow if you want it? Let me know so I don't give it away!",
      objection:
        "I was thinking about your concern. What if we just did a 15-min chat instead of the full assessment? Lower pressure.",
    };
    return nudges[stage] || "Hey, just circling back on this!";
  },
};
