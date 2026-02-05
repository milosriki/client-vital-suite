/**
 * REPAIR ENGINE (Deep Reasoning & Loop Prevention)
 *
 * Goal: Stop "My bad" loops and handle "bad" input smarty.
 * Strategy:
 * 1. CLARITY CHECK: If input is gibberish/slang, use "Deep Context".
 * 2. LOOP BREAKER: If AI says the same thing twice, force a pivot.
 */

export const RepairEngine = {
  detectLoop(lastResponse: string, newResponse: string): boolean {
    if (!lastResponse || !newResponse) return false;

    // 1. Exact Match
    if (lastResponse.trim() === newResponse.trim()) return true;

    // 2. "Apology Loop" Detection
    const apologies = ["my bad", "sorry", "didn't catch that", "missed that"];
    const isApology = apologies.some((a) =>
      newResponse.toLowerCase().includes(a),
    );
    const wasApology = apologies.some((a) =>
      lastResponse.toLowerCase().includes(a),
    );

    if (isApology && wasApology) return true;

    return false;
  },

  generateRepairPrompt(userText: string, history: any[]): string {
    return `
    🔴 CRITICAL ALERT: SYSTEM LOOP DETECTED OR CONFUSION HIGH.
    
    The user wrote: "${userText}"
    Previous responses have failed/looped.
    
    YOUR TASK: "DEEP REASONING"
    1. Ignore typos. (e.g., "thie emojie" -> "this emoji")
    2. Ignore slang. (e.g., "Offer u know" -> "What is your offer?")
    3. Detect Foreign Language. (e.g., "Sta ti nije jasno" -> Serbian for "What isn't clear?")
    
    DO NOT APOLOGIZE AGAIN.
    DO NOT SAY "I didn't catch that".
    
    INSTEAD:
    - Guess their intent with 80% confidence.
    - If they want an offer: "We build custom fitness plans. You want muscle or weight loss?"
    - If they are angry: "I hear you. Let's just get to the point."
    
    OUTPUT ONLY THE NEW, SMART RESPONSE.
    `;
  },
};
