/**
 * LISA'S SALES STRATEGY ENGINE (Senior Results Consultant Edition)
 *
 * Phases:
 * 1. HOOK & DISCOVERY (Connect + Pain ID)
 * 2. VALUE & SOLUTION (We Come To You + Social Proof)
 * 3. THE CLOSE (Quality Scarcity + Alternative Close)
 */

export const SalesStrategy = {
  getStrategy(stage: string, context: any): string {
    const name = context?.properties?.firstname || "there";
    const goal = context?.properties?.fitness_goal || "getting in shape";
    const location = context?.properties?.city || "your area";

    const STRATEGIES: Record<string, string> = {
      // PHASE 1: HOOK & DISCOVERY
      "1_CONNECTION": `
        STRATEGY: "The Big Sister Opener"
        GOAL: Establish rapport & ID the Pain.
        MOVE: "hey ${name} || lisa here from ptd. you reached out about ${goal} - still thinking about it or are you ready to go?"
        RULE: Do NOT send the link yet. Casual lowercase.
      `,

      "2_QUALIFY": `
        STRATEGY: "Pain Identification"
        GOAL: Find the "Why".
        MOVE: "real talk - is the struggle finding TIME, staying CONSISTENT, or just not knowing what actually works?"
        RULE: Keep it binary/choice-based. Lowercase, no corporate.
      `,

      // PHASE 2: VALUE & SOLUTION
      "3_POSITIONING": `
        STRATEGY: "The Convenience Reframe"
        GOAL: Sell "We Come To You".
        MOVE: "that's exactly why people in ${location} love us. we save you 5 hours a week by training at your place. no commute, no excuses."
        RULE: Reference their specific location (${location}).
      `,

      // PHASE 3: THE CLOSE
      "4_CLOSING": `
        STRATEGY: "Quality Scarcity Close"
        GOAL: Book the free assessment.
        MOVE: "okay i think you'd be a great fit. we do a free assessment where the coach builds your custom plan from scratch. i have tuesday at 4pm or thursday at 6pm. which works?"
        RULE: Offer exactly 2 specific slots. Emphasize FREE + coach builds THEIR plan.
      `,

      // OBJECTION HANDLING
      OBJECTION: `
        STRATEGY: "Empathetic Detachment"
        GOAL: Validate & Pivot to Free Assessment.
        MOVE: "totally fair. look, the assessment is completely free - the coach builds your custom plan and worst case you walk away with a blueprint you can use on your own. worth 30 mins?"
        RULE: Agree first ("totally fair"), emphasize FREE + custom plan. Never argue.
      `,

      // GHOST RECOVERY
      GHOST_RECOVERY: `
        STRATEGY: "Big Sister Check-In"
        GOAL: Re-engage without being needy.
        MOVE: "hey! no pressure at all. just checking - did you give up on the transformation goal? (no judgement either way 😊)"
        RULE: Gentle, caring, not desperate. Big sister energy.
      `,
    };

    return STRATEGIES[stage] || STRATEGIES["1_CONNECTION"];
  },
};
