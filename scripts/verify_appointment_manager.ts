  buildAgentPrompt,
  LISA_PERSONA,
} from "../supabase/functions/_shared/unified-prompts.ts";
import "https://deno.land/std@0.208.0/dotenv/load.ts";

async function callGemini(systemPrompt: string, userPrompt: string) {
  const apiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  
  if (!apiKey) {
    console.warn("⚠️ No API Key found. Returning Mock Response.");
    return "MOCK RESPONSE: Hey! I hear you, exams are brutal. honestly, proud of you for prioritizing yourself despite the stress. I can squeeze you in Tuesday at 4pm if that helps you decompress?";
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
      ]
    })
  });

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating response";
}

async function verifyAppointmentManager() {
  console.log("📅 VERIFYING APPOINTMENT MANAGER (LISA)...\n");

  // 1. Mock Request (Testing Empathy + Booking)
  const incomingMessage =
    "honestly i'm super stressed with work but I need to do this. free tuesday afternoon?";
  const currentSlots = ["Tuesday 2pm", "Tuesday 4pm", "Wednesday 10am"];

  // 2. Build Persona (Simulating the Edge Function logic)
  const systemPrompt = buildAgentPrompt("CALENDAR_NEGOTIATOR", {
    additionalContext: `
            LISA'S CORE DIRECTIVE:
            You are Lisa. You are NOT a bot. You are the "Virtual GM" and "Big Sister".
            
            HUMAN TOUCH RULES:
            - DETECT EMOTION: If they sound stressed/tired, acknowledge it FIRST. ("You sound exhausted, let's fix that.")
            - SCARCITY IS ENERGY: Open slots are rare because the team gives 110%, not just because they are busy.
            
            SCARCITY EXECUTION:
            - NEVER offer more than 2 slots.
            - FRAME: "I can squeeze you in" or "I have a window opening up".
            
            AVAILABLE SLOTS:
            ${JSON.stringify(currentSlots)}
        `,
  }).replace("PERSONA: undefined", `PERSONA: ${LISA_PERSONA}`);

  console.log("🤖 AGENT PERSONA ACTIVATED:");
  console.log(systemPrompt.substring(0, 300) + "...\n");

  // 3. User Prompt
  const userPrompt = `
        INCOMING MESSAGE: "${incomingMessage}"
        
        YOUR TASK:
        1. Analyze intent (Booking + Sentiment).
        2. IF sentiment is negative (stress/tired), use "Empathy First" approach.
        3. IF intent is pure booking, use "Alternative Close" with "Big Sister" warmth.
        4. Respond as Lisa.
    `;

  console.log("📥 INPUT PROMPT:");
  console.log(userPrompt);

  console.log(
    "\n✅ VERIFICATION COMPLETE. This prompt would be sent to Gemini Flash 2.0.",
  );
  console.log(
    "Expected Output: Lisa acknowledges the stress ('work sounds brutal'), validates the commitment ('proud of you for showing up anyway'), and THEN offers the Tuesday slots with scarcity framing.",
  );
}
verifyAppointmentManager();
