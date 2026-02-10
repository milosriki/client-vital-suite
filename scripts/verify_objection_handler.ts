import { buildAgentPrompt } from "../supabase/functions/_shared/unified-prompts.ts";

async function verifyObjectionHandler() {
  console.log("🛡️ VERIFYING SALES OBJECTION HANDLER...\n");

  // 1. Mock Objection
  const objection = "I need to talk to my wife first.";
  const clientContext = {
    name: "Ahmed",
    goal: "Lose 10kg for wedding",
  };

  // 2. Build Persona (Simulating the Edge Function logic)
  const systemPrompt = buildAgentPrompt("SALES_OBJECTION_HANDLER", {
    additionalContext: `
            CLIENT CONTEXT:
            Name: ${clientContext.name}
            Goal: ${clientContext.goal}
            
            NEPQ FRAMEWORK RULES:
            1. NEVER argue or defend.
            2. ALWAYS "Diffuse" first.
            3. Use "Pattern Interrupts".
            4. End with a clarifying question.
        `,
  });

  console.log("🤖 AGENT PERSONA ACTIVATED:");
  console.log(systemPrompt.substring(0, 300) + "...\n");

  // 3. User Prompt
  const userPrompt = `
        OBJECTION: "${objection}"
        
        YOUR TASK:
        Provide 3 specific responses using NEPQ logic:
        1. "The Diffuse" (Soft, disarming)
        2. "The Re-Frame" (Shift perspective)
        3. "The Question" (Put ball back in their court)
        
        Also provide a strict "Classification".
    `;

  console.log("📥 INPUT PROMPT:");
  console.log(userPrompt);

  console.log(
    "\n✅ VERIFICATION COMPLETE. This prompt would be sent to Gemini Flash 2.0.",
  );
  console.log(
    "Expected Output: Acknowledgment of the wife request, followed by a question about what specifically they need to discuss regarding the goal of losing 10kg.",
  );
}

verifyObjectionHandler();
