/**
 * ELITE SALES STRATEGY ENGINE (Mark Persona - Dubai Edition)
 *
 * Phases:
 * 1. HOOK & DISCOVERY (Connect + Pain ID)
 * 2. VALUE & SOLUTION (We Come To You + Social Proof)
 * 3. THE CLOSE (Soft Calendly Insert + Scarcity)
 */

export const SalesStrategy = {
  getStrategy(stage: string, context: any): string {
    const name = context?.properties?.firstname || "there";
    const goal = context?.properties?.fitness_goal || "getting fit";
    const location = context?.properties?.city || "your area"; // e.g. "Dubai Marina"

    const STRATEGIES: Record<string, string> = {
      // PHASE 1: HOOK & DISCOVERY
      "1_CONNECTION": `
        STRATEGY: "The Neighborly Opener"
        GOAL: Establish rapport & ID the Pain.
        MOVE: "Hey ${name}! 👋 Mark from PTD. Quick question - you reached out about ${goal}. Still looking to make that happen?"
        RULE: Do NOT send the link yet.
      `,

      "2_QUALIFY": `
        STRATEGY: "Pain Identification"
        GOAL: Find the "Why".
        MOVE: "Is your main struggle finding TIME, MOTIVATION, or just not knowing what to do?"
        RULE: Keep it binary/choice-based.
      `,

      // PHASE 2: VALUE & SOLUTION
      "3_POSITIONING": `
        STRATEGY: "The Convenience Reframe"
        GOAL: Sell "We Come To You".
        MOVE: "That's exactly why clients in ${location} love us. We save you 5 hours/week by training in your living room."
        RULE: Reference their specific location (${location}).
      `,

      // PHASE 3: THE CLOSE
      "4_CLOSING": `
        STRATEGY: "The Soft Close (Scarcity)"
        GOAL: Get the booking.
        MOVE: "I have Tuesday at 7am or Thursday at 6pm available in ${location}. Which works better?"
        RULE: Offer 2 specific slots. DO NOT drop link without slots.
      `,

      // OBJECTION HANDLING
      OBJECTION: `
        STRATEGY: "The Neural Reframe"
        GOAL: Validate & Pivot to Free Assessment.
        MOVE: "I totally get it! But the assessment is 100% free - worth 45 mins just to see the roadmap?"
        RULE: Agree first ("I get it"), then pivot to "Free".
      `,

      // GHOST RECOVERY
      GHOST_RECOVERY: `
        STRATEGY: "Low Pressure Humor"
        GOAL: Re-engage without being annoying.
        MOVE: "Hey! My bad if I overwhelmed you 😅. Simple question: free assessment this week—yes or no?"
        RULE: Use humor.
      `,
    };

    return STRATEGIES[stage] || STRATEGIES["1_CONNECTION"];
  },
};
